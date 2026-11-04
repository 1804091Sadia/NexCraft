// ============================================================
// SECURE CV DOWNLOAD  (FR-41, TC-SEC-01)
// ============================================================

const path = require("path");
const fs = require("fs");
const { getDB } = require("../config/db");
const { str } = require("../utils/constants");
const { idFromRef, findFile, openDownload } = require("../utils/fileStore");

const CV_DIR = path.join(__dirname, "../uploads/cv");

async function canViewCv(viewerId, ownerId) {
    if (viewerId === ownerId) return true;

    const db = getDB();
    const viewer = await db.collection("users").findOne({ user_id: viewerId });
    const roles = viewer?.roles || [];

    if (roles.includes("Admin")) return true;

    if (roles.includes("Employer")) {
        const jobIds = (await db.collection("jobs")
            .find({ employer_id: viewerId })
            .project({ job_id: 1 })
            .toArray()).map(j => j.job_id);

        if (!jobIds.length) return false;

        const application = await db.collection("applications").findOne({
            user_id: ownerId,
            job_id: { $in: jobIds }
        });

        return Boolean(application);
    }

    return false;
}

async function downloadCv(req, res) {
    try {
        const requested = str(req.params.user_id, 80);
        const ownerId = requested === "me" ? req.user.user_id : requested;

        if (!(await canViewCv(req.user.user_id, ownerId))) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to view this CV"
            });
        }

        const profile = await getDB().collection("learner_profiles").findOne({ user_id: ownerId });

        if (!profile?.cv) {
            return res.status(404).json({ success: false, message: "No CV uploaded" });
        }

        
        const user = await getDB().collection("users").findOne({ user_id: ownerId });
        const safeName = String(user?.name || "candidate").replace(/[^\w -]/g, "").trim() || "candidate";

        // New uploads: MongoDB GridFS
        const gridId = idFromRef(profile.cv);
        if (gridId) {
            const file = await findFile(gridId);
            if (!file) {
                return res.status(404).json({ success: false, message: "CV file is missing" });
            }
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${safeName} - CV.pdf"`);
            res.setHeader("Cache-Control", "private, no-store");
            return openDownload(gridId).on("error", () => res.end()).pipe(res);
        }

        // Older uploads still on disk (until scripts/migrateUploads.js is run).
        // Only the file name is used, so "../" tricks cannot leave the folder.
        const filePath = path.join(CV_DIR, path.basename(profile.cv));

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "CV file is missing" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${safeName} - CV.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");

        return res.sendFile(filePath);

    } catch (error) {
        console.error("Download CV error:", error);
        return res.status(500).json({ success: false, message: "Unable to open CV" });
    }
}

// GET /api/files/photo/:id — public profile photos (graduate showcase)
async function getPhoto(req, res) {
    try {
        const id = str(req.params.id, 30);
        const file = await findFile(id);

        if (!file || file.metadata?.kind !== "photo") {
            return res.status(404).json({ success: false, message: "Photo not found" });
        }

        res.setHeader("Content-Type", file.metadata.contentType || "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");

        return openDownload(id).on("error", () => res.end()).pipe(res);

    } catch (error) {
        console.error("Get photo error:", error);
        return res.status(500).json({ success: false, message: "Unable to load photo" });
    }
}

module.exports = { downloadCv, getPhoto };
