import  mongoose, { model } from "mongoose"
import ledger from "./ledger.model.js";

const accountSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required:[true,"account must be associated with a user"],
        index:true

    },
    status:{
        type:String,
        enum:{
            values:["active","frozen","closed"],
            message:"the account can be active, frozen or closed"
        },
        default:"active"
    },
    currency:{
        type:String,
        required:[true, "currency is required"],
        default:"INR"
    },
},{timestamps:true})

accountSchema.index({user:1,status:1})

//we dont save balance in database we use lesure for balance

accountSchema.methods.getBalance=async function(){
            const balanceData = await ledger.aggregate([
            {
                $match: {
                    account: this._id
                }
            },
            {
                $group: {
                    _id: null,

                    totalDebit: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "DEBIT"] },
                                "$ammount",
                                0
                            ]
                        }
                    },

                    totalCredit: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "CREDIT"] },
                                "$ammount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    balance: {
                        $subtract: ["$totalCredit", "$totalDebit"]
                    }
                }
            }
        ])

        if(balanceData.length==0){
            return 0
        }
        return balanceData[0].balance


}
const Account=mongoose.model("account",accountSchema)

export default Account