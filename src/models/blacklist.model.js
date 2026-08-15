import mongoose from "mongoose"

const tokenBlacklistSchema= new mongoose.Schema({
    token:{
        type:String,
        required:[true,"token is required for blacklist"],
        unique:[true,"token is already blacklisted"]
    },
    
},{timestamps:true})


tokenBlacklistSchema.index({createdAt:1},{
    expireAfterSeconds:60*60*24*3
})

const tokenBlacklistModel=mongoose.model("tokenBlacklist",tokenBlacklistSchema)

export default tokenBlacklistModel