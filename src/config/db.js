import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config()

const connectToDB=()=>{
    mongoose.connect(process.env.MONGO_URI)
   
    //.then .catch runs after the promise if you write a print then it wont wait for the promis to return
    .then(()=>{
        console.log("server is connected to db")
    })
    .catch((error)=>{
        console.log("error connecting to db",error.message)
        process.exit(1)
    })
}

export default connectToDB