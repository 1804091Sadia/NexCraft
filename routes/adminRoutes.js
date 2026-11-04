const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const admin = require("../controllers/adminController");

// Every admin route: logged in + Admin role
router.use(authenticateUser, requireRole("Admin"));

router.get("/overview", admin.getOverview);

router.get("/jobs", admin.listJobs);
router.patch("/jobs/:id/approve", admin.approveJob);
router.patch("/jobs/:id/reject", admin.rejectJob);

router.get("/programs", admin.listPrograms);
router.patch("/programs/:id/approve", admin.approveProgram);
router.patch("/programs/:id/reject", admin.rejectProgram);

// Approve/reject: /api/trainer-conversion/admin/:id/approve|reject
router.get("/trainer-applications", admin.listTrainerApplications);

router.get("/users", admin.listUsers);
router.patch("/users/:user_id/suspend", admin.suspendUser);
router.patch("/users/:user_id/reactivate", admin.reactivateUser);

router.get("/role-changes", admin.listRoleChanges);
router.get("/audit-logs", admin.listAuditLogs);

// Hide/show: /api/showcase/:id/hide|show
router.get("/certificates", admin.listCertificates);

router.get("/badges", admin.listBadges);
router.post("/badges", admin.createBadge);
router.post("/badges/:badge_id/award", admin.awardBadge);

router.post("/skills", admin.createSkill);
router.delete("/skills/:skill_id", admin.deleteSkill);

module.exports = router;
