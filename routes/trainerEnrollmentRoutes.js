// ============================================================
// NexCraft - Trainer Enrollment Routes
// File: routes/trainerEnrollmentRoutes.js
// ============================================================

const express = require("express");

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    getTrainerEnrollments,
    updateEnrollmentStatus
} =
    require("../controllers/trainerEnrollmentController");


const router =
    express.Router();


// ============================================================
// GET TRAINER ENROLLMENTS
// GET /api/trainers/enrollments
// ============================================================

router.get(
    "/",
    authenticateUser,
    getTrainerEnrollments
);


// ============================================================
// UPDATE ENROLLMENT STATUS
// PATCH /api/trainers/enrollments/:enrollment_id/status
// ============================================================

router.patch(
    "/:enrollment_id/status",
    authenticateUser,
    updateEnrollmentStatus
);


module.exports = router;