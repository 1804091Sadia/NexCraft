const express = require("express");

const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const { loginLimiter, emailLimiter } = require("../middleware/rateLimit");

const {
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
} = require("../controllers/authController");


router.post("/register", emailLimiter, register);

router.get("/verify-email", verifyEmail);

router.post("/resend-verification", emailLimiter, resendVerification);

router.post("/login", loginLimiter, login);

router.post("/forgot-password", emailLimiter, forgotPassword);

router.post("/reset-password", resetPassword);

router.post("/change-password", authenticateUser, changePassword);

router.get("/me", authenticateUser, getCurrentUser);

router.patch("/me", authenticateUser, updateMe);

// Delete my account (Apple 5.1.1(v), Google Play account-deletion policy)
router.delete("/me", authenticateUser, require("../controllers/accountController").deleteMyAccount);

// No auth needed: it only clears the session cookie
router.post("/logout", logout);


module.exports = router;
