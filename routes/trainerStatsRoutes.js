const express = require("express");

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    getTrainerStats
} = require("../controllers/trainerStatsController");


const router =
    express.Router();


/*
    GET TRAINER STATISTICS

    GET /api/trainers/stats
*/

router.get(
    "/",
    authenticateUser,
    getTrainerStats
);


module.exports = router;