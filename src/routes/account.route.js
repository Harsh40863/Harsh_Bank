import express from "express"
import user_account from "../models/account.model.js"
import {authmiddleware} from "../middleware/auth.middleware.js"
import {createAccountController,getUserAccountsController,getAccountBalanceController} from "../controllers/account.controller.js"




export const account_router=express()

account_router.post("/",authmiddleware,createAccountController)
account_router.get("/",authmiddleware,getUserAccountsController)

account_router.get("/:accountId/balance",authmiddleware,getAccountBalanceController)



