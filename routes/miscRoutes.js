// Small shared endpoints used by several roles
const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const { downloadCv, getPhoto } = require("../controllers/fileController");
const { listSkills, listBadges } = require("../controllers/adminController");

// GET /api/files/cv/:user_id   (FR-41)
router.get("/files/cv/:user_id", authenticateUser, downloadCv);

// GET /api/files/photo/:id — public profile photos (stored in GridFS)
router.get("/files/photo/:id", getPhoto);

// GET /api/skills — master skill catalogue, for suggestions in forms
router.get("/skills", authenticateUser, listSkills);

// GET /api/badge-catalogue — read-only badge list (candidate filters)
router.get("/badge-catalogue", authenticateUser, listBadges);

module.exports = router;
