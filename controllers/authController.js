const { getDB } = require("../config/db");

const { generateUserId } = require("../utils/generateId");

const {
    hashPassword,
    comparePassword,
    validatePassword
} = require("../utils/password");

const {
    generateRandomToken,
    hashToken,
    generateJWT,
    setSessionCookie,
    clearSessionCookie
} = require("../utils/token");


function wantsToken(req) {
    return req.get("X-Auth-Mode") === "token";
}

const {
    sendVerificationEmail,
    sendPasswordResetEmail
} = require("../utils/email");



const GENERIC_RESET_MESSAGE =
    "If the email is registered, a password reset link has been sent.";

function isEmailVerificationEnabled() {
    return process.env.EMAIL_VERIFICATION_ENABLED === "true";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createVerificationToken(db, userId) {
    const rawToken = generateRandomToken();

    await db.collection("email_verification_tokens").insertOne({
        user_id: userId,
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: false,
        created_at: new Date()
    });

    return rawToken;
}


// ===============================
// REGISTER  (FR-01)
// ===============================

async function register(req, res) {
    try {
        const db = getDB();
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        const existingUser = await db.collection("users").findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Try logging in instead."
            });
        }

        const userId = generateUserId();
        const now = new Date();

        await db.collection("users").insertOne({
            user_id: userId,
            name: String(name).trim(),
            email: normalizedEmail,
            password: await hashPassword(password),
            email_verified: !isEmailVerificationEnabled(),
            active_role: null,
            roles: [],
            status: "active",
            created_at: now,
            updated_at: now
        });

        if (isEmailVerificationEnabled()) {
            const rawToken = await createVerificationToken(db, userId);
            await sendVerificationEmail(normalizedEmail, rawToken);
        }

        return res.status(201).json({
            success: true,
            message: isEmailVerificationEnabled()
                ? "Account created. Please check your email to verify your account."
                : "Account created. You can now log in."
        });

    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
}


// ===============================
// VERIFY EMAIL  (FR-01, TC-AUTH-01)
// ===============================

async function verifyEmail(req, res) {
    try {
        const db = getDB();
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Verification token is required"
            });
        }

        const verification = await db
            .collection("email_verification_tokens")
            .findOne({ token_hash: hashToken(token), used: false });

        if (!verification) {
            return res.status(400).json({
                success: false,
                message: "This verification link is invalid or has already been used."
            });
        }

        if (verification.expires_at < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This verification link has expired. Please request a new one."
            });
        }

        
        await db.collection("users").updateOne(
            { user_id: verification.user_id },
            { $set: { email_verified: true, updated_at: new Date() } }
        );

        await db.collection("email_verification_tokens").updateOne(
            { _id: verification._id },
            { $set: { used: true } }
        );

        return res.json({
            success: true,
            message: "Email verified successfully. You can now log in."
        });

    } catch (error) {
        console.error("Email verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Email verification failed"
        });
    }
}


// ===============================
// RESEND VERIFICATION EMAIL
// ===============================

async function resendVerification(req, res) {
    try {
        const db = getDB();
        const normalizedEmail = String(req.body.email || "").trim().toLowerCase();

        const user = await db.collection("users").findOne({ email: normalizedEmail });

        if (user && !user.email_verified && isEmailVerificationEnabled()) {
            await db.collection("email_verification_tokens").updateMany(
                { user_id: user.user_id, used: false },
                { $set: { used: true } }
            );

            const rawToken = await createVerificationToken(db, user.user_id);
            await sendVerificationEmail(normalizedEmail, rawToken);
        }

        return res.json({
            success: true,
            message: "If this account needs verification, a new link has been sent."
        });

    } catch (error) {
        console.error("Resend verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to resend verification email"
        });
    }
}


// ===============================
// LOGIN  (FR-02)
// ===============================

async function login(req, res) {
    try {
        const db = getDB();
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await db.collection("users").findOne({
            email: String(email).trim().toLowerCase()
        });

        // Same generic message for unknown email and wrong password (TC-AUTH-04)
        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // FR-01: verification required before access
        if (isEmailVerificationEnabled() && !user.email_verified) {
            return res.status(403).json({
                success: false,
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email before logging in. Check your inbox."
            });
        }

        await db.collection("users").updateOne(
            { user_id: user.user_id },
            { $set: { last_login_at: new Date() } }
        );

        const token = generateJWT(user);
        setSessionCookie(res, token);

        return res.json({
            success: true,
            message: "Login successful",
            ...(wantsToken(req) ? { token } : {}),
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                active_role: user.active_role,
                roles: user.roles || []
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
        });
    }
}


// ===============================
// FORGOT PASSWORD  (FR-03)
// ===============================

async function forgotPassword(req, res) {
    try {
        const db = getDB();
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await db.collection("users").findOne({ email: normalizedEmail });

        
        if (!user || !user.email_verified) {
            return res.json({ success: true, message: GENERIC_RESET_MESSAGE });
        }

    
        await db.collection("password_reset_tokens").updateMany(
            { user_id: user.user_id, used: false },
            { $set: { used: true } }
        );

        const rawToken = generateRandomToken();

        await db.collection("password_reset_tokens").insertOne({
            user_id: user.user_id,
            token_hash: hashToken(rawToken),
            expires_at: new Date(Date.now() + 15 * 60 * 1000),
            used: false,
            created_at: new Date()
        });

        await sendPasswordResetEmail(normalizedEmail, rawToken);

        return res.json({ success: true, message: GENERIC_RESET_MESSAGE });

    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to process password reset request"
        });
    }
}


// ===============================
// RESET PASSWORD  (FR-03, TC-AUTH-05)
// ===============================

async function resetPassword(req, res) {
    try {
        const db = getDB();
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Token and new password are required"
            });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        const resetToken = await db.collection("password_reset_tokens").findOne({
            token_hash: hashToken(token),
            used: false
        });

        if (!resetToken) {
            return res.status(400).json({
                success: false,
                message: "This reset link is invalid or has already been used."
            });
        }

        if (resetToken.expires_at < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This reset link has expired. Please request a new one."
            });
        }

        const now = new Date();

        await db.collection("users").updateOne(
            { user_id: resetToken.user_id },
            {
                $set: {
                    password: await hashPassword(newPassword),
                    password_changed_at: now,
                    updated_at: now
                }
            }
        );

        
        await db.collection("password_reset_tokens").updateMany(
            { user_id: resetToken.user_id, used: false },
            { $set: { used: true } }
        );

        return res.json({
            success: true,
            message: "Password reset successful. You can now log in with your new password."
        });

    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            success: false,
            message: "Password reset failed"
        });
    }
}


// ===============================
// CHANGE PASSWORD  (FR-36)
// ===============================

async function changePassword(req, res) {
    try {
        const db = getDB();
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        
        const user = await db.collection("users").findOne({
            user_id: req.user.user_id
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!(await comparePassword(currentPassword, user.password))) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        if (await comparePassword(newPassword, user.password)) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from the current password"
            });
        }

        const now = new Date();

        await db.collection("users").updateOne(
            { user_id: user.user_id },
            {
                $set: {
                    password: await hashPassword(newPassword),
                    password_changed_at: now,
                    updated_at: now
                }
            }
        );

        
        const token = generateJWT(user);
        setSessionCookie(res, token);

        return res.json({
            success: true,
            message: "Password changed successfully",
            ...(wantsToken(req) ? { token } : {})
        });

    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to change password"
        });
    }
}


// ===============================
// CURRENT USER
// ===============================

async function getCurrentUser(req, res) {
    try {
        const user = await getDB().collection("users").findOne(
            { user_id: req.user.user_id },
            { projection: { _id: 0, password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({ success: true, user });

    } catch (error) {
        console.error("Get current user error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load user information"
        });
    }
}


// ===============================
// LOGOUT
// ===============================

async function logout(req, res) {
    clearSessionCookie(res);
    return res.json({ success: true, message: "Logout successful" });
}


// ===============================
// UPDATE MY NAME  (Settings page)
// ===============================

async function updateMe(req, res) {
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim().slice(0, 80) : "";

        if (name.length < 2) {
            return res.status(400).json({ success: false, message: "Please enter your full name" });
        }

        await getDB().collection("users").updateOne(
            { user_id: req.user.user_id },
            { $set: { name, updated_at: new Date() } }
        );

        return res.json({ success: true, message: "Name updated", name });

    } catch (error) {
        console.error("Update me error:", error);
        return res.status(500).json({ success: false, message: "Unable to update your name" });
    }
}


module.exports = {
    register,
    verifyEmail,
    resendVerification,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    getCurrentUser,
    updateMe,
    logout
};
