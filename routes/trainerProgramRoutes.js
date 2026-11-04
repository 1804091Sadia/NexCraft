const express = require("express");

const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const requireRole =
    require("../middleware/roleMiddleware");

const requireTrainer =
    requireRole("Trainer");

const {

    getTrainerPrograms,
    getTrainerProgram,
    createTrainerProgram,
    updateTrainerProgram,
    submitTrainerProgram,
    closeTrainerProgram

} = require("../controllers/trainerProgramController");


// ============================================================
// TRAINER PROGRAM ROUTES
// ============================================================

router.get(
    "/",
    authenticateUser,
    requireTrainer,
    getTrainerPrograms
);


router.get(
    "/:program_id",
    authenticateUser,
    requireTrainer,
    getTrainerProgram
);


router.post(
    "/",
    authenticateUser,
    requireTrainer,
    createTrainerProgram
);


router.put(
    "/:program_id",
    authenticateUser,
    requireTrainer,
    updateTrainerProgram
);


router.patch(
    "/:program_id/submit",
    authenticateUser,
    requireTrainer,
    submitTrainerProgram
);


router.patch(
    "/:program_id/close",
    authenticateUser,
    requireTrainer,
    closeTrainerProgram
);


module.exports = router;