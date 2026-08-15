import express from "express"
import {userRegisterController} from "../controllers/auth.controller.js"
import {userLoginController} from "../controllers/auth.controller.js"
import {userLogoutcontroller} from "../controllers/auth.controller.js"

export const authRouter=express.Router()
//small size express object toi. handle request comes to it diverted by app


 authRouter.post("/register",userRegisterController)
 authRouter.post("/login",userLoginController)
 authRouter.get("/logout",userLogoutcontroller)




