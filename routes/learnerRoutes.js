const express = require("express");

const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const upload =
    require("../middleware/uploadMiddleware");

const {
    saveLearnerProfile,
    getLearnerProfile,
    saveSkills
} = require("../controllers/learnerController");


// Get learner profile
router.get(
    "/profile",
    authenticateUser,
    getLearnerProfile
);


// Create learner profile
router.post(
    "/profile",
    authenticateUser,
    upload.fields([
        {
            name: "profile_image",
            maxCount: 1
        },
        {
            name: "cv",
            maxCount: 1
        }
    ]),
    saveLearnerProfile
);


// Edit / update learner profile
router.put(
    "/profile",
    authenticateUser,
    upload.fields([
        {
            name: "profile_image",
            maxCount: 1
        },
        {
            name: "cv",
            maxCount: 1
        }
    ]),
    saveLearnerProfile
);


// Manage skills with proficiency levels (FR-17)
router.put(
    "/skills",
    authenticateUser,
    saveSkills
);


module.exports = router;