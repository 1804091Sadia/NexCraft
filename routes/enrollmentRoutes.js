const express = require("express");
const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    enrollInTraining,
    getMyEnrollments,
    updateProgress
} = require("../controllers/enrollmentController");


router.post(
    "/",
    authenticateUser,
    enrollInTraining
);


router.get(
    "/my",
    authenticateUser,
    getMyEnrollments
);


router.patch(
    "/:enrollment_id/progress",
    authenticateUser,
    updateProgress
);


module.exports = router;