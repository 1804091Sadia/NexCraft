const { getDB } = require("../config/db");

// ========================================
// SELECT INITIAL ROLE
// ========================================

async function selectRole(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        const { role } = req.body;

        const allowedRoles = [
            "Learner",
            "Trainer",
            "Employer"
        ];

        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role selected"
            });
        }

        const user = await db
            .collection("users")
            .findOne({
                user_id: userId
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.active_role) {
            return res.status(400).json({
                success: false,
                message: "You already have an active role"
            });
        }

        const now = new Date();

        if (role === "Trainer") {
            await db.collection("trainer_profiles").updateOne(
                { user_id: userId },
                {
                    $setOnInsert: {
                        user_id: userId,
                        trainer_id: userId,
                        expertise_area: "",
                        bio: "",
                        experience_years: "",
                        created_at: now,
                        updated_at: now
                    }
                },
                { upsert: true }
            );
        }

        await db.collection("users").updateOne(
            {
                user_id: userId
            },
            {
                $set: {
                    active_role: role,
                    updated_at: now
                },
                $addToSet: {
                    roles: role
                }
            }
        );

        await db.collection("role_change_logs").insertOne({
            user_id: userId,
            from_role: null,
            to_role: role,
            changed_at: now,
            reason: "Initial role selection"
        });

        return res.status(200).json({
            success: true,
            message: "Role selected successfully",
            role
        });

    } catch (error) {
        console.error("Role selection error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to select role"
        });
    }
}


// ========================================
// GET CURRENT USER ROLES
// ========================================

async function getMyRoles(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const user = await db
            .collection("users")
            .findOne(
                { user_id: userId },
                {
                    projection: {
                        _id: 0,
                        user_id: 1,
                        roles: 1,
                        active_role: 1
                    }
                }
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            roles: user.roles || [],
            active_role: user.active_role || null
        });

    } catch (error) {
        console.error("Get roles error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load user roles"
        });
    }
}


// ========================================
// SWITCH ACTIVE ROLE
// ========================================

async function switchActiveRole(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const requestedRole =
            typeof req.body.active_role === "string"
                ? req.body.active_role.trim()
                : "";

        const roleMap = {
            learner: "Learner",
            trainer: "Trainer"
        };

        const normalizedRole =
            requestedRole.toLowerCase();

        if (!roleMap[normalizedRole]) {
            return res.status(400).json({
                success: false,
                message:
                    "Active role must be Learner or Trainer"
            });
        }

        const targetRole =
            roleMap[normalizedRole];

        const user = await db
            .collection("users")
            .findOne({
                user_id: userId
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const roles = Array.isArray(user.roles)
            ? user.roles
            : [];

        const hasTargetRole = roles.some(
            role =>
                typeof role === "string" &&
                role.toLowerCase() ===
                    targetRole.toLowerCase()
        );

    
        const isEmployerOrAdmin = roles.some(
            role =>
                typeof role === "string" &&
                ["employer", "admin"].includes(role.toLowerCase())
        );

        if (!hasTargetRole && isEmployerOrAdmin) {
            return res.status(403).json({
                success: false,
                message: "Employer and Admin accounts cannot add the Learner role"
            });
        }

        if (!hasTargetRole && targetRole !== "Learner") {
            return res.status(403).json({
                success: false,
                message:
                    `You do not have the ${targetRole} role`
            });
        }

        if (!hasTargetRole) {
            const now = new Date();

            await db.collection("users").updateOne(
                { user_id: userId },
                {
                    $addToSet: { roles: targetRole },
                    $set: { updated_at: now }
                }
            );

            await db.collection("learner_profiles").updateOne(
                { user_id: userId },
                {
                    $setOnInsert: {
                        user_id: userId,
                        phone: "",
                        location: "",
                        education: "",
                        career: "",
                        track: "",
                        skills: [],
                        bio: "",
                        profile_image: null,
                        cv: null,
                        profile_completed: 0,
                        created_at: now,
                        updated_at: now
                    }
                },
                { upsert: true }
            );

            roles.push(targetRole);
        }

        // ----------------------------------------
        // Make sure the corresponding profile exists
        // ----------------------------------------

        if (targetRole === "Trainer") {
            const trainerProfile =
                await db
                    .collection("trainer_profiles")
                    .findOne({
                        user_id: userId
                    });

            if (!trainerProfile) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Trainer profile not found"
                });
            }
        }

        if (targetRole === "Learner") {
            const learnerProfile =
                await db
                    .collection("learner_profiles")
                    .findOne({
                        user_id: userId
                    });

            if (!learnerProfile) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Learner profile not found"
                });
            }
        }

        const previousRole =
            user.active_role || null;

        
        if (
            previousRole &&
            previousRole.toLowerCase() ===
                targetRole.toLowerCase()
        ) {
            return res.status(200).json({
                success: true,
                message:
                    `You are already using the ${targetRole} portal`,
                active_role: targetRole,
                roles
            });
        }

        const now = new Date();

        await db
            .collection("users")
            .updateOne(
                {
                    user_id: userId
                },
                {
                    $set: {
                        active_role: targetRole,
                        updated_at: now
                    }
                }
            );

        // ----------------------------------------
        // Audit role switch
        // ----------------------------------------

        await db
            .collection("role_switch_logs")
            .insertOne({
                user_id: userId,
                from_role: previousRole,
                to_role: targetRole,
                changed_at: now
            });

        return res.status(200).json({
            success: true,
            message:
                `Switched to ${targetRole} portal`,
            active_role: targetRole,
            roles
        });

    } catch (error) {
        console.error(
            "Active role switch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to switch active role"
        });
    }
}


module.exports = {
    selectRole,
    getMyRoles,
    switchActiveRole
};