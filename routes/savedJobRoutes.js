const express = require("express");
const router = express.Router();

const authenticateUser =
    require("../middleware/authMiddleware");

const {
    saveJob,
    getSavedJobs,
    removeSavedJob,
    checkSavedJob
} = require("../controllers/savedJobController");


router.post(
    "/",
    authenticateUser,
    saveJob
);


router.get(
    "/",
    authenticateUser,
    getSavedJobs
);


router.delete(
    "/:job_id",
    authenticateUser,
    removeSavedJob
);


router.get(
    "/check/:job_id",
    authenticateUser,
    checkSavedJob
);


module.exports = router;