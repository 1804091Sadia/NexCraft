const { getDB } = require("../config/db");

// ============================================================
// GRADUATE SHOWCASE  (FR-45, FR-46, FR-47)
// ============================================================

async function buildShowcaseCards(certificates) {
    const db = getDB();

    const userIds = certificates.map(c => c.user_id);
    const programIds = certificates.map(c => c.program_id);

    const [users, profiles, programs] = await Promise.all([
        db.collection("users")
            .find({ user_id: { $in: userIds } })
            .project({ _id: 0, user_id: 1, name: 1 })
            .toArray(),
        db.collection("learner_profiles")
            .find({ user_id: { $in: userIds } })
            .project({ _id: 0, user_id: 1, profile_image: 1 })
            .toArray(),
        db.collection("training_programs")
            .find({ program_id: { $in: programIds } })
            .project({ _id: 0, program_id: 1, title: 1, level: 1 })
            .toArray()
    ]);

    const byUser = Object.fromEntries(users.map(u => [u.user_id, u]));
    const byProfile = Object.fromEntries(profiles.map(p => [p.user_id, p]));
    const byProgram = Object.fromEntries(programs.map(p => [p.program_id, p]));

    return certificates.map(c => ({
        certificate_id: c.certificate_id,
        certificate_number: c.certificate_number,
        learner_name: byUser[c.user_id]?.name || "Learner",
        profile_image: byProfile[c.user_id]?.profile_image || null,
        programme_title: byProgram[c.program_id]?.title || "Training Program",
        level: byProgram[c.program_id]?.level || "",
        issued_at: c.issued_at || c.completion_date
    }));
}



async function getShowcase(req, res) {
    try {
        let limit = parseInt(req.query.limit, 10);
        if (Number.isNaN(limit) || limit < 1) limit = 6;
        limit = Math.min(limit, 9);

        const certificates = await getDB()
            .collection("certificates")
            .find({ isShowcased: true })
            .sort({ issued_at: -1, completion_date: -1 })
            .limit(limit)
            .toArray();

        return res.status(200).json({
            success: true,
            showcase: await buildShowcaseCards(certificates)
        });

    } catch (error) {
        console.error("Get showcase error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load graduate showcase"
        });
    }
}


// "See All" graduate list
async function getAllGraduates(req, res) {
    try {
        const pageSize = 12;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const filter = { isShowcased: true };

        const [total, certificates] = await Promise.all([
            getDB().collection("certificates").countDocuments(filter),
            getDB().collection("certificates")
                .find(filter)
                .sort({ issued_at: -1, completion_date: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray()
        ]);

        return res.status(200).json({
            success: true,
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            total,
            graduates: await buildShowcaseCards(certificates)
        });

    } catch (error) {
        console.error("Get all graduates error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load graduates"
        });
    }
}


async function setShowcased(req, res, value) {
    try {
        const result = await getDB().collection("certificates").updateOne(
            { certificate_id: req.params.id },
            { $set: { isShowcased: value, showcase_updated_at: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        // FR-43: admin actions are audited
        await getDB().collection("admin_audit_logs").insertOne({
            actor_id: req.user.user_id,
            action: value ? "showcase_show" : "showcase_hide",
            target_type: "certificate",
            target_id: req.params.id,
            created_at: new Date()
        });

        return res.status(200).json({
            success: true,
            message: value
                ? "Restored to showcase successfully"
                : "Hidden from showcase successfully"   
        });

    } catch (error) {
        console.error("Update showcase error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update showcase"
        });
    }
}

const hideShowcase = (req, res) => setShowcased(req, res, false);
const showShowcase = (req, res) => setShowcased(req, res, true);


module.exports = {
    getShowcase,
    getAllGraduates,
    hideShowcase,
    showShowcase
};
