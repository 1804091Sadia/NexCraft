// ========================================
// TRAINER APPLICATION CONTROLLER
// Learner → Trainer Application → Approval
// ========================================

const crypto = require("crypto");
const { getDB } = require("../config/db");
const { notify } = require("../utils/notify");

// ========================================
// LEARNER SUBMITS TRAINER APPLICATION
// ========================================

async function applyForTrainer(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const learner = await db
            .collection("learner_profiles")
            .findOne({ user_id: userId });

        if (!learner) {
            return res.status(404).json({
                success: false,
                message: "Learner profile not found"
            });
        }

        if (
            learner.status &&
            learner.status.toLowerCase() !== "active"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Only an active Learner can apply to become a Trainer"
            });
        }

        const existingTrainer = await db
            .collection("trainer_profiles")
            .findOne({ user_id: userId });

        if (existingTrainer) {
            return res.status(409).json({
                success: false,
                message: "You already have a Trainer profile"
            });
        }

        const existingApplication = await db
            .collection("trainer_applications")
            .findOne({
                user_id: userId,
                status: "pending"
            });

        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message:
                    "Your Trainer application is already pending"
            });
        }

        const expertiseArea =
            typeof req.body.expertise_area === "string"
                ? req.body.expertise_area.trim()
                : "";

        const bio =
            typeof req.body.bio === "string"
                ? req.body.bio.trim()
                : "";

        const experience =
            typeof req.body.experience === "string"
                ? req.body.experience.trim()
                : "";

        if (!expertiseArea) {
            return res.status(400).json({
                success: false,
                message: "Expertise area is required"
            });
        }

        const applicationId =
            `TA-${crypto.randomUUID()}`;

        const now = new Date();

        const application = {
            application_id: applicationId,
            user_id: userId,

            expertise_area: expertiseArea,
            bio: bio,
            experience: experience,

            status: "pending",

            submitted_at: now,

            reviewed_at: null,
            reviewed_by: null,
            rejection_reason: null
        };

        await db
            .collection("trainer_applications")
            .insertOne(application);

        return res.status(201).json({
            success: true,
            message:
                "Trainer application submitted successfully",

            application: {
                application_id: applicationId,
                user_id: userId,
                expertise_area: expertiseArea,
                bio: bio,
                experience: experience,
                status: "pending",
                submitted_at: now
            }
        });

    } catch (error) {
        console.error(
            "Trainer application error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to submit Trainer application"
        });
    }
}


// ========================================
// GET MY LATEST TRAINER APPLICATION
// ========================================

async function getMyTrainerApplication(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const application = await db
            .collection("trainer_applications")
            .find({
                user_id: userId
            })
            .sort({
                submitted_at: -1
            })
            .limit(1)
            .next();

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    "No Trainer application found"
            });
        }

        return res.status(200).json({
            success: true,
            application
        });

    } catch (error) {
        console.error(
            "Get Trainer application error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load Trainer application"
        });
    }
}


// ========================================
// ADMIN AUTHORIZATION HELPER
// ========================================

async function verifyAdmin(db, userId) {
    const user = await db
        .collection("users")
        .findOne({
            user_id: userId
        });

    if (!user) {
        return {
            allowed: false,
            status: 404,
            message: "Admin user not found"
        };
    }

    const roles = Array.isArray(user.roles)
        ? user.roles
        : [];

    const isAdmin = roles.some(
        role =>
            typeof role === "string" &&
            role.toLowerCase() === "admin"
    );

    if (!isAdmin) {
        return {
            allowed: false,
            status: 403,
            message: "Admin access required"
        };
    }

    return {
        allowed: true,
        user
    };
}


// ========================================
// ADMIN — GET PENDING TRAINER APPLICATIONS
// ========================================

async function getPendingTrainerApplications(req, res) {
    try {
        const db = getDB();
        const adminId = req.user.user_id;

        const adminCheck =
            await verifyAdmin(db, adminId);

        if (!adminCheck.allowed) {
            return res.status(adminCheck.status).json({
                success: false,
                message: adminCheck.message
            });
        }

        const applications = await db
            .collection("trainer_applications")
            .find({
                status: "pending"
            })
            .sort({
                submitted_at: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            count: applications.length,
            applications
        });

    } catch (error) {
        console.error(
            "Get pending Trainer applications error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load pending Trainer applications"
        });
    }
}


// ========================================
// ADMIN — APPROVE TRAINER APPLICATION
// ========================================

async function approveTrainerApplication(req, res) {
    try {
        const db = getDB();

        const adminId = req.user.user_id;
        const applicationId =
            req.params.application_id;

        const adminCheck =
            await verifyAdmin(db, adminId);

        if (!adminCheck.allowed) {
            return res.status(adminCheck.status).json({
                success: false,
                message: adminCheck.message
            });
        }

        if (!applicationId) {
            return res.status(400).json({
                success: false,
                message:
                    "Trainer application ID is required"
            });
        }

        const application = await db
            .collection("trainer_applications")
            .findOne({
                application_id: applicationId
            });

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    "Trainer application not found"
            });
        }

        if (application.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    `Application is already ${application.status}`
            });
        }

        const user = await db
            .collection("users")
            .findOne({
                user_id: application.user_id
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Applicant user not found"
            });
        }

        const now = new Date();

        // ----------------------------------------
        // Check whether Trainer profile already exists
        // ----------------------------------------

        const existingTrainer = await db
            .collection("trainer_profiles")
            .findOne({
                user_id: application.user_id
            });

        if (!existingTrainer) {

            const trainerProfile = {
                user_id: application.user_id,
                trainer_id: application.user_id,

                expertise_area:
                    application.expertise_area || "",

                bio:
                    application.bio || "",

                experience:
                    application.experience || "",

                created_at: now,
                updated_at: now
            };

            await db
                .collection("trainer_profiles")
                .insertOne(trainerProfile);
        }

        // ----------------------------------------
        // Preserve existing roles
        // ----------------------------------------

        const currentRoles =
            Array.isArray(user.roles)
                ? user.roles
                : [];

        const normalizedRoles =
            currentRoles.map(role =>
                typeof role === "string"
                    ? role.toLowerCase()
                    : role
            );

        const newRoles = [...currentRoles];

        if (!normalizedRoles.includes("learner")) {
            newRoles.push("Learner");
        }

        if (!normalizedRoles.includes("trainer")) {
            newRoles.push("Trainer");
        }

        // ----------------------------------------
        // Grant Trainer access without changing the user's primary role.
        // ----------------------------------------

        await db
            .collection("users")
            .updateOne(
                {
                    user_id: application.user_id
                },
                {
                    $set: {
                        roles: newRoles,
                        updated_at: now
                    }
                }
            );

        // ----------------------------------------
        // FR-06: Learner status -> "Converted to Trainer".
        // FR-08: the learner profile history stay linked.
        // ----------------------------------------
        await db
            .collection("learner_profiles")
            .updateOne(
                { user_id: application.user_id },
                {
                    $set: {
                        status: "Converted to Trainer",
                        converted_at: now,
                        updated_at: now
                    }
                }
            );

        await notify(
            application.user_id,
            "approval",
            "You are now a Trainer",
            "Your Trainer application was approved. Switch to the Trainer portal to create programs.",
            "/trainer/dashboard.html"
        );

        await db.collection("admin_audit_logs").insertOne({
            actor_id: adminId,
            action: "trainer_application_approve",
            target_type: "trainer_application",
            target_id: applicationId,
            created_at: now
        });

        // ----------------------------------------
        // Mark application approved
        // ----------------------------------------

        await db
            .collection("trainer_applications")
            .updateOne(
                {
                    application_id: applicationId
                },
                {
                    $set: {
                        status: "approved",
                        reviewed_at: now,
                        reviewed_by: adminId,
                        rejection_reason: null
                    }
                }
            );

        // ----------------------------------------
        // Role change audit log
        // ----------------------------------------

        await db
            .collection("role_change_logs")
            .insertOne({
                user_id: application.user_id,
                from_role: "Learner",
                to_role: "Trainer",
                changed_at: now,
                reason:
                    "Trainer application approved by Admin",
                application_id: applicationId,
                reviewed_by: adminId
            });

        return res.status(200).json({
            success: true,
            message:
                "Trainer application approved successfully",

            user_id: application.user_id,

            roles: newRoles,

            active_role: user.active_role || "Learner"
        });

    } catch (error) {
        console.error(
            "Approve Trainer application error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to approve Trainer application"
        });
    }
}


// ========================================
// ADMIN — REJECT TRAINER APPLICATION
// ========================================

async function rejectTrainerApplication(req, res) {
    try {
        const db = getDB();

        const adminId = req.user.user_id;
        const applicationId =
            req.params.application_id;

        const rejectionReason =
            typeof req.body.rejection_reason === "string"
                ? req.body.rejection_reason.trim()
                : "";

        const adminCheck =
            await verifyAdmin(db, adminId);

        if (!adminCheck.allowed) {
            return res.status(adminCheck.status).json({
                success: false,
                message: adminCheck.message
            });
        }

        if (!applicationId) {
            return res.status(400).json({
                success: false,
                message:
                    "Trainer application ID is required"
            });
        }

        const application = await db
            .collection("trainer_applications")
            .findOne({
                application_id: applicationId
            });

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    "Trainer application not found"
            });
        }

        if (application.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    `Application is already ${application.status}`
            });
        }

        
        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "A rejection reason is required"
            });
        }

        const now = new Date();

        await db
            .collection("trainer_applications")
            .updateOne(
                {
                    application_id: applicationId
                },
                {
                    $set: {
                        status: "rejected",
                        reviewed_at: now,
                        reviewed_by: adminId,
                        rejection_reason:
                            rejectionReason || null
                    }
                }
            );

        // ----------------------------------------
        // Audit rejection
        // ----------------------------------------

        await db
            .collection("role_change_logs")
            .insertOne({
                user_id: application.user_id,
                from_role: "Learner",
                to_role: "Trainer",
                action: "application_rejected",
                changed_at: now,
                reason:
                    rejectionReason ||
                    "Trainer application rejected by Admin",
                application_id: applicationId,
                reviewed_by: adminId
            });

        await db.collection("admin_audit_logs").insertOne({
            actor_id: adminId,
            action: "trainer_application_reject",
            target_type: "trainer_application",
            target_id: applicationId,
            reason: rejectionReason,
            created_at: now
        });

        await notify(
            application.user_id,
            "approval",
            "Trainer application not approved",
            `Reason: ${rejectionReason}`,
            "/learner/profile.html"
        );

        return res.status(200).json({
            success: true,
            message:
                "Trainer application rejected successfully",

            application_id: applicationId,
            status: "rejected"
        });

    } catch (error) {
        console.error(
            "Reject Trainer application error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to reject Trainer application"
        });
    }
}


// ========================================
// EXPORTS
// ========================================

module.exports = {
    applyForTrainer,
    getMyTrainerApplication,
    getPendingTrainerApplications,
    approveTrainerApplication,
    rejectTrainerApplication
};