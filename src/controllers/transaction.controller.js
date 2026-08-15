import transaction_model from "../models/transaction.model.js";
import ledger from "../models/ledger.model.js";
import Account from "../models/account.model.js";
import { transaction_mail } from "../services/email.service.js";
import mongoose from "mongoose";


/**
 * ============================================================
 * CREATE NORMAL USER TRANSACTION
 * ============================================================
 *
 * THE TRANSFER FLOW:
 *
 * 1. Validate request
 * 2. Find sender and receiver accounts
 * 3. Check idempotency key
 * 4. Check account status
 * 5. Calculate sender balance from ledger
 * 6. Start MongoDB session
 * 7. Start MongoDB transaction
 * 8. Create transaction with PENDING status
 * 9. Create DEBIT ledger entry for sender
 * 10. Create CREDIT ledger entry for receiver
 * 11. Mark transaction as COMPLETED
 * 12. Commit MongoDB transaction
 * 13. Send email notifications
 *
 * IMPORTANT:
 * The ledger is the source of truth for the balance.
 * We don't directly modify a balance field in Account.
 */
export async function createTransaction(req, res) {

    // Get transaction information from request body
    const {
        fromAccount,
        toAccount,
        ammount,
        IdempotentKey
    } = req.body;
    console.log(fromAccount)
    console.log(toAccount)
    // ========================================================
    // 1. VALIDATE REQUEST
    // ========================================================

    if (
        !fromAccount ||
        !toAccount ||
        !ammount ||
        !IdempotentKey
    ) {
        return res.status(400).json({
            message: "All transaction information is required",
            status: false
        });
    }


    // ========================================================
    // 2. FIND BOTH ACCOUNTS
    // ========================================================
    //
    // populate("user") is required because Account contains
    // only the ObjectId of the user.
    //
    // After populate:
    //
    // fromuserAccount.user.email
    // fromuserAccount.user.name
    //
    // will be available.
    //

    const fromuserAccount = await Account
        .findById(fromAccount)
        .populate("user");

    const touserAccount = await Account
        .findById(toAccount)
        .populate("user");


    // If either account doesn't exist
    if (!fromuserAccount || !touserAccount) {
        return res.status(404).json({
            message: "One or both accounts are not valid",
            status: false
        });
    }


    // ========================================================
    // 3. CHECK IDEMPOTENCY KEY
    // ========================================================
    //
    // The idempotency key is provided by the client.
    //
    // If the client sends the same request again because of
    // a network retry, we don't want to execute the transfer
    // twice.
    //

    const existingTransaction = await transaction_model.findOne({
        idempotencykey: IdempotentKey
    });


    // If a transaction with this idempotency key already exists
    if (existingTransaction) {

        // Transaction already completed
        if (existingTransaction.status === "completed") {
            return res.status(200).json({
                message: "The transaction is already completed",
                transaction: existingTransaction
            });
        }


        // Transaction is still pending
        if (existingTransaction.status === "pending") {
            return res.status(200).json({
                message: "The transaction is still in process"
            });
        }


        // Transaction failed
        if (existingTransaction.status === "failed") {
            return res.status(500).json({
                message: "The transaction has failed"
            });
        }


        // Transaction was reversed
        if (existingTransaction.status === "reversed") {
            return res.status(500).json({
                message: "The transaction has been reversed"
            });
        }
    }


    // ========================================================
    // 4. CHECK ACCOUNT STATUS
    // ========================================================
    //
    // Both accounts must be active.
    //
    // A frozen or closed account cannot participate in a
    // normal transfer.
    //

    if (
        fromuserAccount.status !== "active" ||
        touserAccount.status !== "active"
    ) {
        return res.status(400).json({
            message: "Both accounts must be active",
            status: false
        });
    }


    // ========================================================
    // 5. CALCULATE SENDER BALANCE FROM LEDGER
    // ========================================================
    //
    // getBalance() calculates:
    //
    // total CREDIT - total DEBIT
    //
    // We don't store the balance directly inside Account.
    //

    const balance = await fromuserAccount.getBalance();


    // Check whether sender has enough money
    if (balance < ammount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance: ${balance}, requested: ${ammount}`,
            status: false
        });
    }


    // ========================================================
    // 6. START MONGODB SESSION
    // ========================================================

    const session = await mongoose.startSession();


    try {

        // ====================================================
        // 7. START MONGODB TRANSACTION
        // ====================================================
        //
        // Everything between startTransaction() and
        // commitTransaction() should succeed together.
        //
        // If something fails, abortTransaction() will roll
        // everything back.
        //

        session.startTransaction();


        // ====================================================
        // 8. CREATE TRANSACTION
        // ====================================================
        //
        // Initially the transaction is PENDING.
        //

        const transaction = new transaction_model({

            fromAccount: fromAccount,

            toAccount: toAccount,

            ammount: ammount,

            idempotencykey: IdempotentKey,

            status: "pending"

        });


        // Save transaction inside MongoDB transaction
        await transaction.save({ session });


        // ====================================================
        // 9. CREATE DEBIT LEDGER ENTRY
        // ====================================================
        //
        // Money leaves the sender's account.
        //
        // Example:
        //
        // Sender: -₹500
        //

        const debitLedger = new ledger({

            account: fromAccount,

            ammount: ammount,

            transaction: transaction._id,

            type: "DEBIT"

        });


        await debitLedger.save({ session });


        // ====================================================
        // 10. CREATE CREDIT LEDGER ENTRY
        // ====================================================
        //
        // Money enters the receiver's account.
        //
        // Example:
        //
        // Receiver: +₹500
        //

        const creditLedger = new ledger({

            account: toAccount,

            ammount: ammount,

            transaction: transaction._id,

            type: "CREDIT"

        });


        await creditLedger.save({ session });


        // ====================================================
        // 11. MARK TRANSACTION AS COMPLETED
        // ====================================================

        transaction.status = "completed";

        await transaction.save({ session });


        // ====================================================
        // 12. COMMIT TRANSACTION
        // ====================================================
        //
        // At this point:
        //
        // Transaction ✓
        // Debit ledger ✓
        // Credit ledger ✓
        //
        // All three are committed together.
        //

        await session.commitTransaction();


        // ====================================================
        // 13. SEND EMAIL NOTIFICATIONS
        // ====================================================
        //
        // IMPORTANT:
        // Emails are sent AFTER the database transaction has
        // successfully committed.
        //
        // We don't want to tell the user that money was sent
        // before the database confirms the transfer.
        //


        // ----------------------------------------------------
        // Sender receives DEBIT email
        // ----------------------------------------------------

        await transaction_mail(

            fromuserAccount.user.email,

            fromuserAccount.user.name,

            ammount,

            touserAccount.user.name,

            "DEBIT"

        );


        // ----------------------------------------------------
        // Receiver receives CREDIT email
        // ----------------------------------------------------

        await transaction_mail(

            touserAccount.user.email,

            touserAccount.user.name,

            ammount,

            fromuserAccount.user.name,

            "CREDIT"

        );


        // ====================================================
        // SUCCESS RESPONSE
        // ====================================================

        return res.status(201).json({

            message: "Transaction completed successfully",

            transaction: transaction

        });


    } catch (error) {

        // ====================================================
        // ROLLBACK TRANSACTION
        // ====================================================
        //
        // If ANY operation above fails:
        //
        // Transaction
        // Debit ledger
        // Credit ledger
        //
        // are all rolled back.
        //

        await session.abortTransaction();


        return res.status(500).json({

            message: "Transaction failed",

            error: error.message

        });


    } finally {

        // ====================================================
        // CLOSE SESSION
        // ====================================================

        await session.endSession();

    }
}


/**
 * ============================================================
 * CREATE INITIAL FUND TRANSACTION
 * ============================================================
 *
 * This is different from a normal user-to-user transfer.
 *
 * SYSTEM ACCOUNT
 *       |
 *       | DEBIT
 *       ↓
 * CUSTOMER ACCOUNT
 *       |
 *       | CREDIT
 *
 * Example:
 *
 * System Account  → -₹10,000
 * Customer Account → +₹10,000
 *
 * This can be used when the bank/system initially funds
 * a customer's account.
 */
export async function createIntialFundTransaction(req, res) {

    // Get data from request
    const {
        toAccount,
        ammount,
        idempotentKey
    } = req.body;


    // ========================================================
    // 1. VALIDATE REQUEST
    // ========================================================

    if (
        !toAccount ||
        !ammount ||
        !idempotentKey
    ) {
        return res.status(400).json({
            message: "toAccount, amount and idempotency key are required"
        });
    }


    // ========================================================
    // 2. FIND CUSTOMER ACCOUNT
    // ========================================================

    const touserAccount = await Account.findById(toAccount);


    if (!touserAccount) {
        return res.status(400).json({
            message: "The destination account is not valid"
        });
    }


    // ========================================================
    // 3. FIND SYSTEM USER'S ACCOUNT
    // ========================================================
    //
    // authSystemUserMiddleware has already verified that:
    //
    // req.user.systemUser === true
    //
    // Therefore we only need to find the account belonging
    // to this authenticated system user.
    //

    const fromuserAccount = await Account.findOne({

        user: req.user._id

    });


    if (!fromuserAccount) {
        return res.status(400).json({
            message: "The system user's account is not valid"
        });
    }


    // ========================================================
    // 4. START MONGODB SESSION
    // ========================================================

    const session = await mongoose.startSession();


    try {

        // ====================================================
        // 5. START TRANSACTION
        // ====================================================

        session.startTransaction();


        // ====================================================
        // 6. CREATE TRANSACTION RECORD
        // ====================================================

        const transaction = new transaction_model({

            fromAccount: fromuserAccount._id,

            toAccount: touserAccount._id,

            ammount: ammount,

            idempotencykey: idempotentKey,

            status: "pending"

        });


        await transaction.save({ session });


        // ====================================================
        // 7. DEBIT SYSTEM ACCOUNT
        // ====================================================
        //
        // Money leaves the system account.
        //

        const debitLedger = new ledger({

            account: fromuserAccount._id,

            ammount: ammount,

            transaction: transaction._id,

            type: "DEBIT"

        });


        await debitLedger.save({ session });


        // ====================================================
        // 8. CREDIT CUSTOMER ACCOUNT
        // ====================================================
        //
        // Money enters the customer's account.
        //

        const creditLedger = new ledger({

            account: touserAccount._id,

            ammount: ammount,

            transaction: transaction._id,

            type: "CREDIT"

        });


        await creditLedger.save({ session });


        // ====================================================
        // 9. COMPLETE TRANSACTION
        // ====================================================

        transaction.status = "completed";

        await transaction.save({ session });


        // ====================================================
        // 10. COMMIT TRANSACTION
        // ====================================================

        await session.commitTransaction();


        // ====================================================
        // SUCCESS RESPONSE
        // ====================================================

        return res.status(201).json({

            message: "Initial fund transaction completed",

            transaction: transaction

        });


    } catch (error) {

        // ====================================================
        // ROLLBACK IF ANYTHING FAILS
        // ====================================================

        await session.abortTransaction();


        return res.status(500).json({

            message: "Initial fund transaction failed",

            error: error.message

        });


    } finally {

        // ====================================================
        // CLOSE SESSION
        // ====================================================

        await session.endSession();

    }
}