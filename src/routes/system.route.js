import express from "express"
import { authSystemUserMiddleware } from "../middleware/auth.middleware.js"
import { getLoansDisbursedController, getUsersLoansController } from "../controllers/system.controller.js"

const system_router = express.Router()

system_router.get("/loans-disbursed", authSystemUserMiddleware, getLoansDisbursedController)
system_router.get("/users-loans", authSystemUserMiddleware, getUsersLoansController)

export default system_router
