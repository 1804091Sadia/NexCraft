// ============================================================
// ADMIN MODULE  (FR-27 .. FR-32, FR-42, FR-43, FR-46)
// Routes: routes/adminRoutes.js  (all require role "Admin")
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");
const { notify } = require("../utils/notify");
const { LISTING_STATUS, escapeRegex, str } = require("../utils/constants");

function fail(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function serverError(res, label, error) {
    console.error(`${label}:`, error);
    return fail(res, 500, "Something went wrong. Please try again.");
}

// FR-43: every approval, rejection, suspension and reactivation is logged
async function audit(req, action, targetType, targetId, extra = {}) {
    await getDB().collection("admin_audit_logs").insertOne({
        actor_id: req.user.user_id,
        action,
        target_type: targetType,
        target_id: targetId,
        ...extra,
        created_at: new Date()
    });
}

async function nameMap(userIds) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return {};

    const users = await getDB().collection("users")
        .find({ user_id: { $in: ids } })
        .project({ _id: 0, user_id: 1, name: 1, email: 1 })
        .toArray();

    return Object.fromEntries(users.map(u => [u.user_id, u]));
}


// ============================================================
// OVERVIEW  (FR-32)
// ============================================================

async function getOverview(req, res) {
    try {
        const db = getDB();
        const count = (collection, filter = {}) =>
            db.collection(collection).countDocuments(filter);

        const [
            users, learners, trainers, employers, admins, suspended,
            activeJobs, pendingJobs, activePrograms, pendingPrograms,
            applications, enrollments, certificates, pendingTrainerApps
        ] = await Promise.all([
            count("users"),
            count("users", { roles: "Learner" }),
            count("users", { roles: "Trainer" }),
            count("users", { roles: "Employer" }),
            count("users", { roles: "Admin" }),
            count("users", { status: "suspended" }),
            count("jobs", { status: LISTING_STATUS.ACTIVE }),
            count("jobs", { status: LISTING_STATUS.PENDING }),
            count("training_programs", { status: LISTING_STATUS.ACTIVE }),
            count("training_programs", { status: LISTING_STATUS.PENDING }),
            count("applications"),
            count("enrollments"),
            count("certificates"),
            count("trainer_applications", { status: "pending" })
        ]);

        const recent = await db.collection("admin_audit_logs")
            .find({}).sort({ created_at: -1 }).limit(8).toArray();
        const names = await nameMap(recent.map(r => r.actor_id));

        return res.json({
            success: true,
            users: { total: users, learners, trainers, employers, admins, suspended },
            jobs: { active: activeJobs, pending: pendingJobs },
            programs: { active: activePrograms, pending: pendingPrograms },
            applications,
            enrollments,
            certificates,
            pendingTrainerApplications: pendingTrainerApps,
            recentActions: recent.map(r => ({
                action: r.action,
                target_type: r.target_type,
                target_id: r.target_id,
                reason: r.reason || "",
                actor_name: names[r.actor_id]?.name || "Admin",
                created_at: r.created_at
            }))
        });

    } catch (error) {
        return serverError(res, "Admin overview error", error);
    }
}


// ============================================================
// APPROVALS — jobs (FR-28) and programs (FR-29)
// ============================================================

const LISTINGS = {
    job: {
        collection: "jobs",
        idField: "job_id",
        ownerField: "employer_id",
        label: "Job",
        ownerLink: "/employer/jobs.html"
    },
    program: {
        collection: "training_programs",
        idField: "program_id",
        ownerField: "trainer_id",
        label: "Program",
        ownerLink: "/trainer/programs.html"
    }
};

function listListings(kind) {
    return async (req, res) => {
        try {
            const config = LISTINGS[kind];
            const status = str(req.query.status, 30) || LISTING_STATUS.PENDING;
            const filter = status === "all" ? {} : { status };

            const items = await getDB().collection(config.collection)
                .find(filter)
                .project({ _id: 0 })
                .sort({ submitted_at: -1, updated_at: -1 })
                .limit(200)
                .toArray();

            const owners = await nameMap(items.map(i => i[config.ownerField] || i.user_id));

            return res.json({
                success: true,
                items: items.map(item => ({
                    ...item,
                    owner_name: owners[item[config.ownerField] || item.user_id]?.name || "Unknown"
                }))
            });

        } catch (error) {
            return serverError(res, `Admin list ${kind}s error`, error);
        }
    };
}

function reviewListing(kind, decision) {
    return async (req, res) => {
        try {
            const config = LISTINGS[kind];
            const id = str(req.params.id, 80);
            const reason = str(req.body.reason, 1000);

            // TC-JOB-03: rejection without a reason fails validation
            if (decision === "reject" && !reason) {
                return fail(res, 400, "A rejection reason is required");
            }

            const db = getDB();
            const item = await db.collection(config.collection).findOne({ [config.idField]: id });

            if (!item) return fail(res, 404, `${config.label} not found`);

            if (item.status !== LISTING_STATUS.PENDING) {
                return fail(res, 400, `Only items pending approval can be reviewed (this one is ${item.status})`);
            }

            const now = new Date();
            const update = decision === "approve"
                ? { status: LISTING_STATUS.ACTIVE, rejection_reason: "", approved_at: now }
                : { status: LISTING_STATUS.REJECTED, rejection_reason: reason };

            await db.collection(config.collection).updateOne(
                { [config.idField]: id },
                { $set: { ...update, reviewed_by: req.user.user_id, reviewed_at: now, updated_at: now } }
            );

            await audit(req, `${kind}_${decision}`, kind, id, reason ? { reason } : {});

            await notify(
                item[config.ownerField] || item.user_id,
                "approval",
                decision === "approve"
                    ? `${config.label} approved`
                    : `${config.label} not approved`,
                decision === "approve"
                    ? `"${item.title}" is now live.`
                    : `"${item.title}" was rejected. Reason: ${reason}. Edit it and submit again.`,
                config.ownerLink
            );

            return res.json({
                success: true,
                message: decision === "approve"
                    ? `${config.label} approved and now visible to learners`
                    : `${config.label} rejected`
            });

        } catch (error) {
            return serverError(res, `Admin ${decision} ${kind} error`, error);
        }
    };
}


// ============================================================
// TRAINER APPLICATIONS (FR-30) — list only, approval/rejection is in trainerController
// ============================================================

async function listTrainerApplications(req, res) {
    try {
        const status = str(req.query.status, 20) || "pending";
        const filter = status === "all" ? {} : { status };

        const items = await getDB().collection("trainer_applications")
            .find(filter).project({ _id: 0 }).sort({ submitted_at: -1 }).limit(200).toArray();

        const names = await nameMap(items.map(i => i.user_id));

        return res.json({
            success: true,
            items: items.map(i => ({
                ...i,
                applicant_name: names[i.user_id]?.name || "Unknown",
                applicant_email: names[i.user_id]?.email || ""
            }))
        });

    } catch (error) {
        return serverError(res, "Admin trainer applications error", error);
    }
}


// ============================================================
// USERS  (FR-30)
// ============================================================

async function listUsers(req, res) {
    try {
        const pageSize = 20;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const filter = {};

        const q = str(req.query.q, 80);
        const role = str(req.query.role, 20);
        const status = str(req.query.status, 20);

        if (q) {
            const pattern = { $regex: escapeRegex(q), $options: "i" };
            filter.$or = [{ name: pattern }, { email: pattern }];
        }
        if (["Learner", "Trainer", "Employer", "Admin"].includes(role)) filter.roles = role;
        if (["active", "suspended"].includes(status)) filter.status = status;

        const db = getDB();
        const [total, users] = await Promise.all([
            db.collection("users").countDocuments(filter),
            db.collection("users")
                .find(filter)
                .project({ _id: 0, password: 0 })
                .sort({ created_at: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray()
        ]);

        return res.json({
            success: true,
            page,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            users
        });

    } catch (error) {
        return serverError(res, "Admin list users error", error);
    }
}

function setUserStatus(newStatus) {
    return async (req, res) => {
        try {
            const userId = str(req.params.user_id, 80);
            const reason = str(req.body.reason, 500);

            if (userId === req.user.user_id) {
                return fail(res, 400, "You cannot change your own account status");
            }

            if (newStatus === "suspended" && !reason) {
                return fail(res, 400, "Please give a reason for the suspension");
            }

            const db = getDB();
            const user = await db.collection("users").findOne({ user_id: userId });

            if (!user) return fail(res, 404, "User not found");

            if (user.status === newStatus) {
                return fail(res, 400, `This account is already ${newStatus}`);
            }

            await db.collection("users").updateOne(
                { user_id: userId },
                {
                    $set: {
                        status: newStatus,
                        status_reason: reason,
                        status_changed_at: new Date(),
                        updated_at: new Date()
                    }
                }
            );

            await audit(req,
                newStatus === "suspended" ? "user_suspend" : "user_reactivate",
                "user", userId, reason ? { reason } : {});

            if (newStatus === "active") {
                await notify(userId, "account", "Account reactivated",
                    "Your NexCraft account is active again.", null);
            }

            return res.json({
                success: true,
                message: newStatus === "suspended"
                    ? `${user.name} is suspended and has been signed out`
                    : `${user.name} is active again`
            });

        } catch (error) {
            return serverError(res, "Admin set user status error", error);
        }
    };
}


// ============================================================
// LOGS  (FR-31, FR-43)
// ============================================================

async function listRoleChanges(req, res) {
    try {
        const logs = await getDB().collection("role_change_logs")
            .find({ to_role: "Trainer" })
            .project({ _id: 0 })
            .sort({ changed_at: -1 })
            .limit(300)
            .toArray();

        const names = await nameMap([
            ...logs.map(l => l.user_id),
            ...logs.map(l => l.reviewed_by)
        ]);

        return res.json({
            success: true,
            logs: logs.map(l => ({
                ...l,
                user_name: names[l.user_id]?.name || l.user_id,
                reviewer_name: l.reviewed_by ? names[l.reviewed_by]?.name || "Admin" : ""
            }))
        });

    } catch (error) {
        return serverError(res, "Admin role changes error", error);
    }
}

async function listAuditLogs(req, res) {
    try {
        const logs = await getDB().collection("admin_audit_logs")
            .find({})
            .project({ _id: 0 })
            .sort({ created_at: -1 })
            .limit(300)
            .toArray();

        const names = await nameMap(logs.map(l => l.actor_id));

        return res.json({
            success: true,
            logs: logs.map(l => ({ ...l, actor_name: names[l.actor_id]?.name || "Admin" }))
        });

    } catch (error) {
        return serverError(res, "Admin audit logs error", error);
    }
}


// ============================================================
// SHOWCASE MANAGEMENT  (FR-46) 
// ============================================================

async function listCertificates(req, res) {
    try {
        const db = getDB();
        const certificates = await db.collection("certificates")
            .find({})
            .project({ _id: 0 })
            .sort({ issued_at: -1, completion_date: -1 })
            .limit(300)
            .toArray();

        const names = await nameMap(certificates.map(c => c.user_id));
        const programs = await db.collection("training_programs")
            .find({ program_id: { $in: certificates.map(c => c.program_id) } })
            .project({ _id: 0, program_id: 1, title: 1, level: 1 })
            .toArray();
        const byProgram = Object.fromEntries(programs.map(p => [p.program_id, p]));

        return res.json({
            success: true,
            certificates: certificates.map(c => ({
                certificate_id: c.certificate_id,
                certificate_number: c.certificate_number,
                learner_name: names[c.user_id]?.name || "Learner",
                programme_title: byProgram[c.program_id]?.title || "Program",
                level: byProgram[c.program_id]?.level || "",
                issued_at: c.issued_at || c.completion_date,
                isShowcased: c.isShowcased !== false
            }))
        });

    } catch (error) {
        return serverError(res, "Admin certificates error", error);
    }
}


// ============================================================
// BADGES  (FR-42) — master catalogue + award
// ============================================================

async function listBadges(req, res) {
    try {
        const db = getDB();
        const badges = await db.collection("badges")
            .find({}).project({ _id: 0 }).sort({ name: 1 }).toArray();

        const counts = await db.collection("learner_badges").aggregate([
            { $group: { _id: "$badge_id", count: { $sum: 1 } } }
        ]).toArray();
        const byBadge = Object.fromEntries(counts.map(c => [c._id, c.count]));

        return res.json({
            success: true,
            badges: badges.map(b => ({ ...b, awarded_count: byBadge[b.badge_id] || 0 }))
        });

    } catch (error) {
        return serverError(res, "List badges error", error);
    }
}

async function createBadge(req, res) {
    try {
        const name = str(req.body.name, 60);
        const description = str(req.body.description, 300);
        const icon = str(req.body.icon, 8) || "🏅";

        if (!name) return fail(res, 400, "Badge name is required");

        const db = getDB();
        const exists = await db.collection("badges").findOne({
            name: { $regex: `^${escapeRegex(name)}$`, $options: "i" }
        });
        if (exists) return fail(res, 409, "A badge with this name already exists");

        const badge = {
            badge_id: `BDG-${crypto.randomUUID()}`,
            name, description, icon,
            created_by: req.user.user_id,
            created_at: new Date()
        };

        await db.collection("badges").insertOne(badge);
        delete badge._id;

        return res.status(201).json({ success: true, message: "Badge created", badge });

    } catch (error) {
        return serverError(res, "Create badge error", error);
    }
}

async function awardBadge(req, res) {
    try {
        const db = getDB();
        const badgeId = str(req.params.badge_id, 80);
        const userId = str(req.body.user_id, 80);

        const [badge, user] = await Promise.all([
            db.collection("badges").findOne({ badge_id: badgeId }),
            db.collection("users").findOne({ user_id: userId })
        ]);

        if (!badge) return fail(res, 404, "Badge not found");
        if (!user || !(user.roles || []).includes("Learner")) {
            return fail(res, 400, "Badges can only be awarded to learners");
        }

        const already = await db.collection("learner_badges").findOne({
            badge_id: badgeId, user_id: userId
        });
        if (already) return fail(res, 409, `${user.name} already has this badge`);

        const now = new Date();

        await db.collection("learner_badges").insertOne({
            badge_id: badgeId,
            user_id: userId,
            name: badge.name,
            title: badge.name,
            description: badge.description,
            icon: badge.icon,
            awarded_by: req.user.user_id,
            earned_at: now,
            created_at: now
        });

        await audit(req, "badge_award", "user", userId, { badge_id: badgeId, badge_name: badge.name });

        // TC-BADGE-01: learner notified
        await notify(userId, "badge", `You earned a badge: ${badge.name}`,
            badge.description || "Congratulations!", "/learner/badges.html");

        return res.json({ success: true, message: `"${badge.name}" awarded to ${user.name}` });

    } catch (error) {
        return serverError(res, "Award badge error", error);
    }
}


// ============================================================
// SKILLS CATALOGUE  
// ============================================================

async function listSkills(req, res) {
    try {
        const skills = await getDB().collection("skills")
            .find({}).project({ _id: 0 }).sort({ category: 1, name: 1 }).toArray();
        return res.json({ success: true, skills });
    } catch (error) {
        return serverError(res, "List skills error", error);
    }
}

async function createSkill(req, res) {
    try {
        const name = str(req.body.name, 40);
        const category = str(req.body.category, 40) || "General";

        if (!name) return fail(res, 400, "Skill name is required");

        const db = getDB();
        const exists = await db.collection("skills").findOne({
            name: { $regex: `^${escapeRegex(name)}$`, $options: "i" }
        });
        if (exists) return fail(res, 409, "This skill is already in the catalogue");

        const skill = { skill_id: `SKL-${crypto.randomUUID()}`, name, category, created_at: new Date() };
        await db.collection("skills").insertOne(skill);
        delete skill._id;

        return res.status(201).json({ success: true, message: "Skill added", skill });

    } catch (error) {
        return serverError(res, "Create skill error", error);
    }
}

async function deleteSkill(req, res) {
    try {
        const result = await getDB().collection("skills").deleteOne({
            skill_id: str(req.params.skill_id, 80)
        });
        if (!result.deletedCount) return fail(res, 404, "Skill not found");
        return res.json({ success: true, message: "Skill removed from the catalogue" });
    } catch (error) {
        return serverError(res, "Delete skill error", error);
    }
}


module.exports = {
    getOverview,
    listJobs: listListings("job"),
    approveJob: reviewListing("job", "approve"),
    rejectJob: reviewListing("job", "reject"),
    listPrograms: listListings("program"),
    approveProgram: reviewListing("program", "approve"),
    rejectProgram: reviewListing("program", "reject"),
    listTrainerApplications,
    listUsers,
    suspendUser: setUserStatus("suspended"),
    reactivateUser: setUserStatus("active"),
    listRoleChanges,
    listAuditLogs,
    listCertificates,
    listBadges,
    createBadge,
    awardBadge,
    listSkills,
    createSkill,
    deleteSkill
};
