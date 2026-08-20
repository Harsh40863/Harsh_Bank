import Account from "../models/account.model.js";
import ledger from "../models/ledger.model.js";
import userModel from "../models/user_model.js";


/**
 * ============================================================
 * GET ALL LOANS DISBURSED BY SYSTEM ACCOUNTS
 * ============================================================
 *
 * Admin audit endpoint that aggregates all DEBIT entries from
 * system reserve accounts to show AI-approved (or manually
 * initiated) loan disbursements.
 *
 * Pipeline:
 * 1. Find all system users → their account IDs
 * 2. Match DEBIT ledger entries for those accounts
 * 3. $lookup transaction → get destination account
 * 4. $lookup account → get recipient user ObjectId
 * 5. $lookup user → get recipient name/email
 * 6. Project clean output, sort by date descending
 */
export async function getLoansDisbursedController(req, res) {
    try {

        // ====================================================
        // 1. FIND ALL SYSTEM USERS
        // ====================================================

        const systemUsers = await userModel
            .find({ systemUser: true })
            .select("_id");

        if (systemUsers.length === 0) {
            return res.status(200).json({ loans: [] });
        }

        const systemUserIds = systemUsers.map(u => u._id);


        // ====================================================
        // 2. FIND ALL SYSTEM ACCOUNTS
        // ====================================================

        const systemAccounts = await Account.find({
            user: { $in: systemUserIds }
        });

        const systemAccountIds = systemAccounts.map(a => a._id);

        if (systemAccountIds.length === 0) {
            return res.status(200).json({ loans: [] });
        }


        // ====================================================
        // 3. AGGREGATION PIPELINE
        // ====================================================
        //
        // Match all DEBITs from system accounts, then
        // join with transactions, accounts, and users
        // to get the full picture of each disbursement.
        //

        const loans = await ledger.aggregate([
            {
                $match: {
                    account: { $in: systemAccountIds },
                    type: "DEBIT"
                }
            },
            {
                $lookup: {
                    from: "transactions",
                    localField: "transaction",
                    foreignField: "_id",
                    as: "txData"
                }
            },
            { $unwind: "$txData" },
            {
                $lookup: {
                    from: "accounts",
                    localField: "txData.toAccount",
                    foreignField: "_id",
                    as: "recipientAccount"
                }
            },
            { $unwind: "$recipientAccount" },
            {
                $lookup: {
                    from: "users",
                    localField: "recipientAccount.user",
                    foreignField: "_id",
                    as: "recipientUser"
                }
            },
            { $unwind: "$recipientUser" },
            {
                $project: {
                    _id: 1,
                    ammount: 1,
                    category: 1,
                    createdAt: 1,
                    transactionId: "$txData._id",
                    transactionStatus: "$txData.status",
                    recipientAccountId: "$recipientAccount._id",
                    recipientName: "$recipientUser.name",
                    recipientEmail: "$recipientUser.email"
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        return res.status(200).json({ loans });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch disbursed loans",
            error: error.message
        });
    }
}


/**
 * ============================================================
 * GET ALL USERS AND THEIR LOAN STATUS
 * ============================================================
 *
 * Checks all users (excluding system users) and returns their:
 * - account ID
 * - name, email
 * - 30-day CREDIT volume
 * - loan status: "Granted" (if already got loan), "Eligible" (>50k volume), or "Ineligible"
 */
export async function getUsersLoansController(req, res) {
    try {
        const systemUsers = await userModel.find({ systemUser: true }).select("_id");
        const systemUserIds = systemUsers.map(u => u._id);

        const accounts = await Account.find({
            user: { $nin: systemUserIds }
        }).populate("user");

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const usersLoans = [];

        for (const account of accounts) {
            if (!account.user) continue;

            // 1. Calculate 30-day credit volume
            const creditResult = await ledger.aggregate([
                {
                    $match: {
                        account: account._id,
                        type: "CREDIT",
                        createdAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCredit: { $sum: "$ammount" }
                    }
                }
            ]);
            const creditVolume = creditResult.length > 0 ? creditResult[0].totalCredit : 0;

            // 2. Check if they have received a loan (CREDIT entry with category "Transfer")
            const loanLedgerEntry = await ledger.findOne({
                account: account._id,
                type: "CREDIT",
                category: "Transfer"
            }).populate({
                path: "transaction",
                match: { status: "completed" }
            });

            let loanStatus = "Ineligible";
            let loanAmount = 0;

            if (loanLedgerEntry && loanLedgerEntry.transaction) {
                loanStatus = "Granted";
                loanAmount = loanLedgerEntry.ammount;
            } else if (creditVolume > 50000) {
                loanStatus = "Eligible";
            }

            usersLoans.push({
                accountId: account._id,
                name: account.user.name,
                email: account.user.email,
                creditVolume: creditVolume,
                loanStatus: loanStatus,
                loanAmount: loanAmount,
                accountStatus: account.status
            });
        }

        return res.status(200).json({ users: usersLoans });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch users loan status list",
            error: error.message
        });
    }
}
