const express = require("express");

const router = express.Router();

// ========================================
// MIDDLEWARE
// ========================================

const authenticateUser = require("../middleware/authMiddleware");

const requireRole = require("../middleware/roleMiddleware");

const requireTrainer = requireRole("Trainer");

const upload = require("../middleware/uploadMiddleware");

// ========================================
// CONTROLLER
// ========================================

const {
  getTrainerProfile,

  createTrainerProfile,

  updateTrainerProfile,

  getTrainerDashboard,
} = require("../controllers/trainerController");

// ========================================
// TRAINER DASHBOARD
// ========================================

router.get("/dashboard", authenticateUser, requireTrainer, getTrainerDashboard);

// ========================================
// TRAINER PROFILE
// ========================================

// GET PROFILE

router.get("/profile", authenticateUser, requireTrainer, getTrainerProfile);

// CREATE PROFILE

router.post(
  "/profile",
  authenticateUser,
  requireTrainer,
  upload.single("profile_image"),
  createTrainerProfile,
);

// UPDATE PROFILE

router.put(
  "/profile",
  authenticateUser,
  requireTrainer,
  upload.single("profile_image"),
  updateTrainerProfile,
);

module.exports = router;
