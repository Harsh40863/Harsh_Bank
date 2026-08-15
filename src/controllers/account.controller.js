import user_account from "../models/account.model.js"

export async function createAccountController(req,res){
    const user=req.user

    const account= await user_account.create({
        user:user._id
    })

    res.status(201).json({
        message:"the acount has been created",
        user:user
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


