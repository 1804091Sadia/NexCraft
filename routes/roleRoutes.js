const express = require("express");

const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    selectRole,
    getMyRoles,
    switchActiveRole
} = require("../controllers/roleController");


// ========================================
// INITIAL ROLE SELECTION
// ========================================

router.post(
    "/select",
    authenticateUser,
    selectRole
);


// ========================================
// GET MY ROLES
// ========================================

router.get(
    "/my",
    authenticateUser,
    getMyRoles
);


// ========================================
// SWITCH ACTIVE ROLE
// ========================================

router.patch(
    "/active",
    authenticateUser,
    switchActiveRole
);


module.exports = router;