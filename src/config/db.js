import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config()

const connectToDB=()=>{
    mongoose.connect(process.env.MONGO_URI)
   
    //.then .catch runs after the promise if you write a print then it wont wait for the promis to return
    .then(async ()=>{
        console.log("server is connected to db")
        
        // Auto-seed the bank user and its account
        try {
            const userModel = (await import("../models/user_model.js")).default;
            const Account = (await import("../models/account.model.js")).default;

            let bankUser = await userModel.findOne({ email: "bank@harshbank.com" });
            if (!bankUser) {
                bankUser = await userModel.create({
                    email: "bank@harshbank.com",
                    name: "bank",
                    password: "bankpassword",
                    systemUser: true
                });
                console.log("Seeded default bank user: bank@harshbank.com / bankpassword");
            }

            const BANK_ACCOUNT_ID = "000000000000000000000000";
            await Account.deleteMany({ user: bankUser._id, _id: { $ne: BANK_ACCOUNT_ID } });

            const bankAccount = await Account.findOne({ _id: BANK_ACCOUNT_ID });
            if (!bankAccount) {
                await Account.create({
                    _id: BANK_ACCOUNT_ID,
                    user: bankUser._id,
                    status: "active",
                    currency: "INR"
                });
                console.log("Seeded default bank account for bank user with ID: 000000000000000000000000");
            }
        } catch (seedErr) {
            console.log("Error seeding bank user:", seedErr.message);
        }
    })
    .catch((error)=>{
        console.log("error connecting to db",error.message)
        process.exit(1)
    })
}

export default connectToDB