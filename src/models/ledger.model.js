import mongoose from "mongoose";
import account from "../models/account.model.js"
import transaction from "./transaction.model.js";

const ledgerSchema=new mongoose.Schema({
    account:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true, "ledger must be associated with the account"],
        index:true,
        immutable:true
    },
    ammount:{
        type:Number,
        required:[true,"ammount is required"],
        immutable:true
    },
    transaction:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"transaction",
        required:[true,"there should be a legit transaction"],
        index:true,
        immutable:true
    },
    type:{
        type:String,
        enum:{
            values:["CREDIT","DEBIT"],
            message:"Type can be Debit or Credit"
        },
        required:[true,"ledge type is required"],
        immutable:true
    },
    category:{
        type:String,
        enum:{
            values:["Food","Shopping","Bills","Entertainment","Travel","Health","Education","Investment","Transfer","Other"],
            message:"Category must be one of: Food, Shopping, Bills, Entertainment, Travel, Health, Education, Investment, Transfer, Other"
        },
        default:"Other",
        immutable:true
    }

},{timestamps:true})

// Compound index for efficient 30-day analytics and loan-eligibility aggregation queries
ledgerSchema.index({account: 1, type: 1, createdAt: -1})

function preventLedgerModification() {
    throw new Error("Ledger entries are immutable and cannot be modified or deleted");
}

ledgerSchema.pre('findOneAndUpdate', preventLedgerModification);
ledgerSchema.pre('updateOne', preventLedgerModification);
ledgerSchema.pre('deleteOne', preventLedgerModification);
ledgerSchema.pre('remove', preventLedgerModification);
ledgerSchema.pre('deleteMany', preventLedgerModification);
ledgerSchema.pre('updateMany', preventLedgerModification);
ledgerSchema.pre('findOneAndDelete', preventLedgerModification);
ledgerSchema.pre('findOneAndReplace', preventLedgerModification);

const ledger=mongoose.model("legder",ledgerSchema)

export default ledger