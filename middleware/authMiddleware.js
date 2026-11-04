const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { readSessionCookie } = require("../utils/token");


async function authenticateUser(req, res, next) {
    
    const authHeader = req.headers.authorization || "";
    const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const token = headerToken.split(".").length === 3
        ? headerToken
        : readSessionCookie(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session has expired. Please log in again."
        });
    }

    try {
        const user = await getDB()
            .collection("users")
            .findOne(
                { user_id: decoded.user_id },
                { projection: { status: 1, password_changed_at: 1 } }
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found. Please log in again."
            });
        }

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        
        if (
            user.password_changed_at &&
            decoded.iat * 1000 < new Date(user.password_changed_at).getTime() - 1000
        ) {
            return res.status(401).json({
                success: false,
                message: "Your password was changed. Please log in again."
            });
        }

        req.user = decoded;
        next();

    } catch (error) {
        next(error);
    }
}

module.exports = authenticateUser;
