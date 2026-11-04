const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const employer = require("../controllers/employerController");

// Every employer route: logged in + Employer role
router.use(authenticateUser, requireRole("Employer"));

router.get("/dashboard", employer.getDashboard);

router.get("/profile", employer.getProfile);
router.put("/profile", employer.saveProfile);

router.get("/jobs", employer.listJobs);
router.post("/jobs", employer.createJob);
router.get("/jobs/:job_id", employer.getJob);
router.put("/jobs/:job_id", employer.updateJob);
router.patch("/jobs/:job_id/submit", employer.submitJob);
router.patch("/jobs/:job_id/close", employer.closeJob);
router.delete("/jobs/:job_id", employer.deleteDraftJob);

router.get("/applications", employer.listApplications);
router.patch("/applications/:application_id/status", employer.updateApplicationStatus);
router.patch("/applications/:application_id/rating", employer.rateApplicant);

router.get("/candidates", employer.searchCandidates);

module.exports = router;
