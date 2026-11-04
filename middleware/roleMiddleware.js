// ========================================
// ROLE MIDDLEWARE
// ========================================

const { getDB } = require("../config/db");

function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            // -------------------------------
            // AUTHENTICATION CHECK
            // -------------------------------

            if (!req.user || !req.user.user_id) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required"
                });
            }


            // -------------------------------
            // LOAD CURRENT USER FROM DATABASE
            // -------------------------------

            const db = getDB();

            const user = await db
                .collection("users")
                .findOne({
                    user_id: req.user.user_id
                });


            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }


            // -------------------------------
            // GRANTED ROLES
            // -------------------------------

            const userRoles = Array.isArray(user.roles)
                ? user.roles
                : [];

            const normalizedUserRoles = userRoles
                .filter(role => typeof role === "string")
                .map(role => role.toLowerCase());

            const activeRole = typeof user.active_role === "string"
                ? user.active_role.toLowerCase()
                : null;

            const hasAllowedRole = allowedRoles.some(role => {
                const normalizedRole = role.toLowerCase();
                return normalizedUserRoles.includes(normalizedRole) ||
                    activeRole === normalizedRole;
            });

            if (!hasAllowedRole) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied for this role"
                });
            }


            // -------------------------------
            // KEEP REQUEST USER CONSISTENT
            // -------------------------------

            req.user.active_role = user.active_role || null;
            req.user.roles = userRoles;


            next();

        } catch (error) {

            console.error(
                "Role middleware error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Role authorization failed"
            });
        }
    };
}

module.exports = requireRole;