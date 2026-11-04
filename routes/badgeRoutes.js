const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");

const {
    getMyBadges
} = require("../controllers/badgeController");


router.get(
    "/my",
    authenticateUser,
    getMyBadges
);


module.exports = router;