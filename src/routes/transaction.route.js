import express from "express"
import { authmiddleware } from "../middleware/auth.middleware.js"
import {createTransaction} from "../controllers/transaction.controller.js"
import { createIntialFundTransaction } from "../controllers/transaction.controller.js"
import { authSystemUserMiddleware } from "../middleware/auth.middleware.js"

export const router=express()


router.post("/",authmiddleware,createTransaction)
router.post("/system/initial-fund",authSystemUserMiddleware,createIntialFundTransaction)



export default router