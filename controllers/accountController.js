// ============================================================
// DELETE MY ACCOUNT
// DELETE /api/auth/me   { password, confirm: "DELETE" }
//
// Required for app stores: Apple guideline 5.1.1(v) and Google Play's
// account-deletion policy both require that users who can create an
// account can delete it (and its personal data) from inside the app.
//
// What happens:
//  - Personal data is deleted: user record, profiles, CV and photo files,
//    applications, saved jobs, enrollments, certificates, badges,
//    notifications, tokens.
//  - Data other people rely on is kept but anonymised:
//      messages they received from you  -> sender shown as "Deleted user"
//      your job posts / programs        -> closed, owner name removed
//  - Admin audit logs keep the user id (security record, no personal data).
// ============================================================

const { getDB } = require("../config/db");
const { comparePassword } = require("../utils/password");
const { clearSessionCookie } = require("../utils/token");
const { idFromRef, deleteFile } = require("../utils/fileStore");

async function deleteMyAccount(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (req.body.confirm !== "DELETE") {
            return res.status(400).json({
                success: false,
                message: 'Type DELETE to confirm that you want to delete your account'
            });
        }

        const user = await db.collection("users").findOne({ user_id: userId });

        if (!user) {
            return res.status(404).json({ success: false, message: "Account not found" });
        }

        if (!(await comparePassword(password, user.password))) {
            return res.status(401).json({ success: false, message: "Password is incorrect" });
        }

        // The platform must keep at least one Admin
        if ((user.roles || []).includes("Admin")) {
            const admins = await db.collection("users").countDocuments({ roles: "Admin", status: "active" });
            if (admins <= 1) {
                return res.status(400).json({
                    success: false,
                    message: "You are the only Admin. Create another Admin before deleting this account."
                });
            }
        }

        const now = new Date();

        // ---- files (photo + CV) ----------------------------------
        const learner = await db.collection("learner_profiles").findOne({ user_id: userId });
        const trainer = await db.collection("trainer_profiles").findOne({ user_id: userId });

        const applicationCvs = await db.collection("applications")
            .find({ user_id: userId }).project({ cv: 1 }).toArray();

        const fileRefs = new Set([
            learner?.profile_image, learner?.cv, trainer?.profile_image,
            ...applicationCvs.map(a => a.cv)
        ]);

        for (const ref of fileRefs) {
            const id = idFromRef(ref);
            if (id) await deleteFile(id);
        }

        // ---- the person's own data -------------------------------
        const own = { user_id: userId };
        await Promise.all([
            db.collection("learner_profiles").deleteOne(own),
            db.collection("trainer_profiles").deleteOne(own),
            db.collection("employer_profiles").deleteOne(own),
            db.collection("applications").deleteMany(own),
            db.collection("saved_jobs").deleteMany(own),
            db.collection("enrollments").deleteMany(own),
            db.collection("certificates").deleteMany(own),
            db.collection("learner_badges").deleteMany(own),
            db.collection("notifications").deleteMany(own),
            db.collection("trainer_applications").deleteMany(own),
            db.collection("email_verification_tokens").deleteMany(own),
            db.collection("password_reset_tokens").deleteMany(own),
            db.collection("role_switch_logs").deleteMany(own)
        ]);

        // ---- shared data: keep, but anonymise -------------------
        await Promise.all([
            // Your job posts and programs close and lose your name
            db.collection("jobs").updateMany(
                { employer_id: userId },
                { $set: { status: "closed", company: "Deleted company", company_name: "Deleted company", closed_at: now } }
            ),
            db.collection("training_programs").updateMany(
                { trainer_id: userId, status: { $ne: "closed" } },
                { $set: { status: "closed", closed_at: now } }
            ),
            // Messages: delete what you received, keep what others received from you
            db.collection("messages").deleteMany({ receiver_id: userId }),
            db.collection("role_change_logs").updateMany(own, { $set: { user_deleted: true } })
        ]);

        // ---- finally the login itself ------------------------------
        await db.collection("users").deleteOne({ user_id: userId });

        await db.collection("admin_audit_logs").insertOne({
            actor_id: userId,
            action: "account_self_delete",
            target_type: "user",
            target_id: userId,
            created_at: now
        });

        clearSessionCookie(res);

        return res.json({
            success: true,
            message: "Your account and personal data have been deleted."
        });

    } catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ success: false, message: "Unable to delete account. Please try again." });
    }
}

module.exports = { deleteMyAccount };
