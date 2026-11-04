// ========================================
// TRAINER APPLICATION ROUTES
// ========================================

const express = require("express");

const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    applyForTrainer,
    getMyTrainerApplication,
    getPendingTrainerApplications,
    approveTrainerApplication,
    rejectTrainerApplication
} = require("../controllers/trainerConversionController");


// ========================================
// LEARNER
// ========================================

// Submit Trainer application
router.post(
    "/apply",
    authenticateUser,
    applyForTrainer
);


// Get current user's latest Trainer application
router.get(
    "/my-application",
    authenticateUser,
    getMyTrainerApplication
);


// ========================================
// ADMIN
// ========================================

// Get all pending Trainer applications
router.get(
    "/admin/pending",
    authenticateUser,
    getPendingTrainerApplications
);


// Approve Trainer application
router.patch(
    "/admin/:application_id/approve",
    authenticateUser,
    approveTrainerApplication
);


// Reject Trainer application
router.patch(
    "/admin/:application_id/reject",
    authenticateUser,
    rejectTrainerApplication
);


// ========================================
// BACKWARD COMPATIBILITY
// ========================================

// Existing frontend may still call /convert.
// It now behaves as an application submission,
// NOT an immediate conversion.
router.post(
    "/convert",
    authenticateUser,
    applyForTrainer
);


module.exports = router;