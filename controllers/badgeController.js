const { getDB } = require("../config/db");

async function getMyBadges(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const badges = await db.collection("learner_badges")
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            badges
        });

    } catch (error) {
        console.error("Get learner badges error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load badges"
        });
    }
}

module.exports = {
    getMyBadges
};