import user_model from "../models/user_model.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import tokenBlacklistModel from "../models/blacklist.model.js";

dotenv.config();


export async function authmiddleware(req, res, next) {

    // Get token from cookie OR Authorization header
    const token =
        req.cookies.token ||
        req.headers.authorization?.split(" ")[1];

    const istokenBlacklist=tokenBlacklistModel.findOne({
        token
    })

    if(istokenBlacklist){
        return res.status(401).json({
            message:"Unauthorization entry token is invalid"
        })
    }
    // No token
    if (!token) {
        return res.status(401).json({
            message: "User is not logged in",
            status: false
        });
    }

    try {

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find user using the userId stored inside JWT
        const user = await user_model.findById(
            decoded.userId
        );

        // User doesn't exist
        if (!user) {
            return res.status(401).json({
                message: "User not found",
                status: false
            });
        }

        // Attach authenticated user to request
        req.user = user;

        // Continue to next middleware/controller
        return next();

    } catch (err) {

        return res.status(401).json({
            message: "Token is invalid or expired",
            status: false
        });
    }
}


export async function authSystemUserMiddleware(req, res, next) {

    // Get token from cookie OR Authorization header
    const token =
        req.cookies.token ||
        req.headers.authorization?.split(" ")[1];
    
    // No token
    if (!token) {
        return res.status(401).json({
            message: "Authorization access token is missing",
            status: false
        });
    }
    const istokenBlacklist=tokenBlacklistModel.findOne({
        token
    })

    if(istokenBlacklist){
        return res.status(401).json({
            message:"Unauthorization entry token is invalid"
        })
    }

    try {

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find user and explicitly include systemUser
        const user = await user_model
            .findById(decoded.userId)
            .select("+systemUser");

        // User doesn't exist
        if (!user) {
            return res.status(401).json({
                message: "User not found",
                status: false
            });
        }

        // User exists but isn't a system user
        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, you are not a system user",
                status: false
            });
        }

        // Attach system user to request
        req.user = user;

        // Continue to controller
        return next();

    } catch (err) {

        return res.status(401).json({
            message: "Token is invalid or expired",
            status: false
        });
    }
}