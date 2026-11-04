const express = require("express");
const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    getJobs,
    getJobById
} = require("../controllers/jobController");


// Get all jobs
router.get(
    "/",
    authenticateUser,
    getJobs
);


// Get single job
router.get(
    "/:id",
    authenticateUser,
    getJobById
);


module.exports = router;