import mongoose from "mongoose"
import account from "../models/account.model.js"

const transactionSchema=new mongoose.Schema({
    fromAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        index:true

    },
    toAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        index:true
    },
    status:{
        type:String,
        enum:{
            values:["pending","completed","failed","reversed"],
            message:"status can be pending complete failed or reversed"
        },
        default:"PENDING"
    },
    ammount:{
        type:Number,
        required:[true,"Ammount is required for creating a transaction"],
        min:[0,"transaction cannot be negative"]
    },
    idempotencykey:{
        type:String,
        required:[true,"Idempotency is required for creating a transaction"],
        index:true,
        unique:true
    }
},{
    timestamps:true
})


const transaction=mongoose.model("transaction",transactionSchema)

export default transaction