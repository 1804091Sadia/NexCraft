const { getDB } = require("../config/db");
const { escapeRegex, str } = require("../utils/constants");

// FR-14: filter by keyword, category, mode, level, skill
function buildProgramFilter(query) {
    const filter = { status: "active" };
    const q = str(query.q, 80);
    const skill = str(query.skill, 40);

    if (q) {
        const pattern = { $regex: escapeRegex(q), $options: "i" };
        filter.$or = [{ title: pattern }, { description: pattern }];
    }
    ["category", "mode", "level"].forEach(field => {
        const value = str(query[field], 60);
        if (value) filter[field] = value;
    });
    if (skill) filter.skill_tags = { $regex: `^${escapeRegex(skill)}$`, $options: "i" };

    return filter;
}


// Get all active training programs
async function getTrainingPrograms(req, res) {
    try {
        const db = getDB();

        const programs = await db.collection("training_programs")
            .find(buildProgramFilter(req.query))
            .sort({
                created_at: -1
            })
            .toArray();

        return res.status(200).json({
            success: true,
            programs
        });

    } catch (error) {
        console.error("Get training programs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load training programs"
        });
    }
}


// Get one training program
async function getTrainingProgramById(req, res) {
    try {
        const db = getDB();
        const { id } = req.params;

        const program =
            await db.collection("training_programs").findOne({
                program_id: id,
                status: "active"
            });

        if (!program) {
            return res.status(404).json({
                success: false,
                message: "Training program not found"
            });
        }

        return res.status(200).json({
            success: true,
            program
        });

    } catch (error) {
        console.error(
            "Get training program error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load training program"
        });
    }
}


module.exports = {
    getTrainingPrograms,
    getTrainingProgramById
};