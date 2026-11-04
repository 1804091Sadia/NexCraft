const express = require("express");
const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    getTrainingPrograms,
    getTrainingProgramById
} = require("../controllers/trainingController");


router.get(
    "/",
    authenticateUser,
    getTrainingPrograms
);


router.get(
    "/:id",
    authenticateUser,
    getTrainingProgramById
);


module.exports = router;