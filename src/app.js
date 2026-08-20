//import exprress create app ----> mongo db ----> schema ---->routes----->controllers---->services
import express from "express"
import { authRouter } from "./routes/auth.routes.js";
import cookieParser from "cookie-parser"
import { account_router } from "./routes/account.route.js";
import transaction from "./models/transaction.model.js";
import transaction_router from "./routes/transaction.route.js";
import system_router from "./routes/system.route.js";




// create server instance and server config config means to tell it which middleware and waht are the routes used


const app=express()
//now app has given you application objects which has methoads like .get and .listen

app.use(express.json())
app.use(cookieParser())
app.use(express.static("public"))

app.use("/api/auth",authRouter)
app.use("/api/accounts",account_router)
app.use("/api/transaction",transaction_router)
app.use("/api/system",system_router)
//when ever a request come with this url send it to this route
//nodemon is a pckage used ehn u do a in the js files it automaticcaly retarts the server

export default app;