import user_account from "../models/account.model.js"
import ledger from "../models/ledger.model.js"

export async function createAccountController(req,res){
    const user=req.user

    const account= await user_account.create({
        user:user._id
    })

    res.status(201).json({
        message:"the acount has been created",
        user:user,
        account:account
    })
}

export async function getUserAccountsController(req,res){
    const accounts=await user_account.find({user:req.user._id})

    return res.status(200).json({
        accounts
    })
}

export async function getAccountBalanceController(req,res){
    const {accountId}=req.params
    console.log("ACCOUNT ID FROM URL:", accountId);
    console.log("LOGGED IN USER ID:", req.user._id);
    const account = await user_account.findOne({
        _id:accountId,
        user:req.user._id
    })

    console.log("ACCOUNT BY ID:", account);
    if (!account){
        return res.status(404).json({
            message:"account not found"
        })
    }

    const balance = await account.getBalance()

    res.status(200).json({
        accountId:accountId,
        balance:balance
    })
}


/**
 * ============================================================
 * GET SPEND ANALYTICS (LAST 30 DAYS)
 * ============================================================
 *
 * MongoDB aggregation pipeline:
 * 1. $match: DEBIT entries for this account in last 30 days
 * 2. $group: Sum amounts by category
 * 3. $project: Clean output with category name and total
 * 4. $sort: Highest spending category first
 *
 * Existing ledger entries without a category will be
 * grouped as "Uncategorized" via $ifNull.
 *
 * Returns: { analytics: [{ category: "Food", total: 5000 }, ...] }
 */
export async function getSpendAnalyticsController(req, res) {
    try {
        const { accountId } = req.params;

        const account = await user_account.findOne({
            _id: accountId,
            user: req.user._id
        });

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const analytics = await ledger.aggregate([
            {
                $match: {
                    account: account._id,
                    type: "DEBIT",
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: "$category",
                    total: { $sum: "$ammount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: { $ifNull: ["$_id", "Uncategorized"] },
                    total: 1
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        return res.status(200).json({ analytics });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch spend analytics",
            error: error.message
        });
    }
}


/**
 * ============================================================
 * GET LOAN ELIGIBILITY (LAST 30 DAYS)
 * ============================================================
 *
 * MongoDB aggregation pipeline:
 * 1. $match: CREDIT entries for this account in last 30 days
 * 2. $group: Sum all credit amounts
 *
 * Logic:
 * - If 30-day credit volume > ₹50,000 → eligible for ₹10,000 loan
 * - Else → not eligible
 *
 * Returns: { eligible: true/false, max_amount: number, total_credit_volume: number }
 */
export async function getLoanEligibilityController(req, res) {
    try {
        const { accountId } = req.params;

        const account = await user_account.findOne({
            _id: accountId,
            user: req.user._id
        });

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await ledger.aggregate([
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

        const totalCredit = result.length > 0 ? result[0].totalCredit : 0;

        if (totalCredit > 50000) {
            return res.status(200).json({
                eligible: true,
                max_amount: 10000,
                total_credit_volume: totalCredit
            });
        } else {
            return res.status(200).json({
                eligible: false,
                max_amount: 0,
                total_credit_volume: totalCredit
            });
        }

    } catch (error) {
        return res.status(500).json({
            message: "Failed to check loan eligibility",
            error: error.message
        });
    }
}
