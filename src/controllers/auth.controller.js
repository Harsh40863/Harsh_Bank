import userModel from "../models/user_model.js"
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import {testemail} from "../services/email.service.js"
import bcrypt from "bcryptjs"
import tokenBlacklistModel from "../models/blacklist.model.js"
import cookieParser from "cookie-parser"

dotenv.config()


// user register controller and 
// api=POST /API/AUTH/REGITER

export const userRegisterController= async (req,res)=>{
    try {
        const {email,password,name,systemUser}=req.body

        const isExists= await userModel.findOne({
            email:email
        })

        if(isExists){
            return res.status(422).json({
                message:"user already exist",
                status:false
            })
        }
        const user=await userModel.create({
            email,password,name,
            systemUser: systemUser === true || systemUser === "true"
        })
        //model will give every user a unique id that is user._id that u are sendin in payload of cookie
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );
        //now we have to set this token in cokkie

        res.cookie("token",token)


        res.status(201).json({
            user:{
                _id:user._id,
                email:user.email,
                name:user.name,
                systemUser: user.systemUser
            },token
        })
        await testemail(user.email,user.name)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
            status: false
        });
    }
}

//now logicn controllers
export const  userLoginController= async (req,res)=>{
    try {
        const {email,password}=req.body

        const user= await userModel.findOne({email}).select("+password +systemUser")

        if(!user){
            return res.status(401).json({
                message:"email or password is invalid",
                status:false
            })
        }

        const valid_password= await user.comparePassword(password)

        if(!valid_password){
            return res.status(401).json({
                message:"email or password is invalid",
                status:false
            })
        }
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );
        //now we have to set this token in cokkie

        res.cookie("token",token)



        res.status(200).json({
            user:{
                _id:user._id,
                email:user.email,
                name:user.name,
                systemUser: user.systemUser
            },
            token
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message,
            status: false
        });
    }
}

export const userLogoutcontroller = async (req,res)=>{

    const token =req.cookies?.token || req.headers.authorization?.split(" ")[1]
    if(!token){
        return res.status(200).json({
            message:"you are already logout"
        })
    }

    res.clearCookie("token");
    await tokenBlacklistModel.create({
        token:token
    })

    return res.status(200).json({
        message:"User logged out successfully"
    })
}

