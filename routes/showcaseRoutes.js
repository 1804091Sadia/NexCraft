const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
    getShowcase,
    getAllGraduates,
    hideShowcase,
    showShowcase
} = require("../controllers/showcaseController");


// Public
router.get("/", getShowcase);
router.get("/all", getAllGraduates);

// Admin only (TC-SHOW-05: Learner/Employer must get 403)
router.patch("/:id/hide", authenticateUser, requireRole("Admin"), hideShowcase);
router.patch("/:id/show", authenticateUser, requireRole("Admin"), showShowcase);


module.exports = router;
