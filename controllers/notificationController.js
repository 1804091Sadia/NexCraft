const { getDB } = require("../config/db");

// ============================================================
// NOTIFICATIONS  (FR-35, FR-44)
// ============================================================


async function getNotifications(req, res) {
    try {
        const filter = { user_id: req.user.user_id };
        if (req.query.unread === "true") filter.is_read = false;

        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const [notifications, unreadCount] = await Promise.all([
            getDB().collection("notifications")
                .find(filter)
                .project({ _id: 0 })
                .sort({ created_at: -1 })
                .limit(limit)
                .toArray(),
            getDB().collection("notifications")
                .countDocuments({ user_id: req.user.user_id, is_read: false })
        ]);

        return res.json({ success: true, unreadCount, notifications });

    } catch (error) {
        console.error("Get notifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load notifications"
        });
    }
}


async function markRead(req, res) {
    try {
        const result = await getDB().collection("notifications").updateOne(
            { notification_id: req.params.id, user_id: req.user.user_id },
            { $set: { is_read: true, read_at: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        return res.json({ success: true, message: "Marked as read" });

    } catch (error) {
        console.error("Mark notification read error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update notification"
        });
    }
}


async function markAllRead(req, res) {
    try {
        const result = await getDB().collection("notifications").updateMany(
            { user_id: req.user.user_id, is_read: false },
            { $set: { is_read: true, read_at: new Date() } }
        );

        return res.json({
            success: true,
            message: "All notifications marked as read",
            updated: result.modifiedCount
        });

    } catch (error) {
        console.error("Mark all notifications read error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update notifications"
        });
    }
}

module.exports = { getNotifications, markRead, markAllRead };
