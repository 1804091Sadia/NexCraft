const express = require("express");

const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    createApplication,
    getApplications,
    withdrawApplication
} = require("../controllers/applicationController");


// Submit application
router.post(
    "/",
    authenticateUser,
    createApplication
);


// Get logged-in learner's applications
router.get(
    "/",
    authenticateUser,
    getApplications
);


// Withdraw own application (FR-37)
router.patch(
    "/:application_id/withdraw",
    authenticateUser,
    withdrawApplication
);


module.exports = router;