// ============================================================
// SYSTEM NOTIFICATIONS  (FR-35)
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");

/**
 * @param {string} userId   receiver user_id ("USR-...")
 * @param {string} type     e.g. "application_status", "enrollment_status",
 *                          "approval", "badge", "message"
 * @param {string} title    short headline shown in the bell dropdown
 * @param {string} body     one sentence of detail
 * @param {string} [link]   frontend page to open when clicked
 */



async function notify(userId, type, title, body, link = null) {
    if (!userId || !type || !title || !body) return;

    try {
        const result = await getDB().collection("notifications").insertOne({
            notification_id: `NTF-${crypto.randomUUID()}`,
            user_id: userId,
            type,
            title,
            body,
            link,
            is_read: false,
            created_at: new Date()
        });

        return result;
    } catch (error) {
        console.error("Notification error:", error);
    }
}

module.exports = { notify };
