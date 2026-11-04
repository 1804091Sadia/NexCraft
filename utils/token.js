const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function generateRandomToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function generateJWT(user) {

    return jwt.sign(
        {
            user_id: user.user_id,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
}

// ------------------------------------------------------------
// Session cookie (OWASP: keep the token out of JavaScript's reach)
// HttpOnly  -> page scripts cannot read it, so XSS cannot steal it
// SameSite  -> browsers do not send it from other sites (CSRF)
// Secure    -> HTTPS only in production
// ------------------------------------------------------------

const SESSION_COOKIE = "nexcraft_session";

function setSessionCookie(res, token) {
    const decoded = jwt.decode(token);
    const maxAge = decoded?.exp
        ? Math.max(0, decoded.exp * 1000 - Date.now())
        : 24 * 60 * 60 * 1000;

    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
}

function readSessionCookie(req) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
    return null;
}

module.exports = {
    setSessionCookie,
    clearSessionCookie,
    readSessionCookie,
    generateRandomToken,
    hashToken,
    generateJWT
};