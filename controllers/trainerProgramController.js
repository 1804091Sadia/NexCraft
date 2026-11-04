// ============================================================
// TRAINER PROGRAM CONTROLLER
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");


// ============================================================
// HELPER
// ============================================================

function cleanSkills(skillTags) {

    if (!Array.isArray(skillTags)) {
        return [];
    }

    return [
        ...new Set(
            skillTags
                .map(skill => String(skill).trim())
                .filter(Boolean)
        )
    ];
}


// ============================================================
// GET TRAINER PROGRAMS
// ============================================================

async function getTrainerPrograms(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;


        const programs = await db
            .collection("training_programs")
            .find({
                $or: [
                    { trainer_id: userId },
                    { user_id: userId }
                ]
            })
            .sort({ created_at: -1 })
            .toArray();


        const programIds =
            programs.map(program => program.program_id);


        let enrollmentCounts = {};


        if (programIds.length > 0) {

            const counts = await db
                .collection("enrollments")
                .aggregate([
                    {
                        $match: {
                            program_id: {
                                $in: programIds
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$program_id",
                            count: {
                                $sum: 1
                            }
                        }
                    }
                ])
                .toArray();


            counts.forEach(item => {

                enrollmentCounts[item._id] =
                    item.count;

            });

        }


        const result = programs.map(program => ({

            ...program,

            enrollment_count:
                enrollmentCounts[
                    program.program_id
                ] || 0

        }));


        return res.status(200).json({

            success: true,

            programs: result

        });


    } catch (error) {

        console.error(
            "Get trainer programs error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load training programs."

        });

    }

}


// ============================================================
// GET SINGLE PROGRAM
// ============================================================

async function getTrainerProgram(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;

        const programId =
            req.params.program_id;


        const program =
            await db
                .collection("training_programs")
                .findOne({
                    program_id: programId,

                    $or: [
                        { trainer_id: userId },
                        { user_id: userId }
                    ]
                });


        if (!program) {

            return res.status(404).json({

                success: false,

                message:
                    "Training program not found."

            });

        }


        const enrollmentCount =
            await db
                .collection("enrollments")
                .countDocuments({
                    program_id: programId
                });


        return res.status(200).json({

            success: true,

            program: {

                ...program,

                enrollment_count:
                    enrollmentCount

            }

        });


    } catch (error) {

        console.error(
            "Get trainer program error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load training program."

        });

    }

}


// ============================================================
// CREATE PROGRAM
// ============================================================

async function createTrainerProgram(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;


        const {

            title,
            category,
            mode,
            duration,
            description,
            prerequisites,
            skill_tags,
            level

        } = req.body;


        // =========================
        // REQUIRED VALIDATION
        // =========================

        if (!title || !title.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Program title is required."

            });

        }


        if (!category || !category.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Category is required."

            });

        }


        if (!mode || !mode.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Mode is required."

            });

        }


        if (!duration || !duration.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Duration is required."

            });

        }


        if (!description || !description.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Description is required."

            });

        }


        const program = {

            program_id:
                `TRN-${crypto.randomUUID()}`,

            trainer_id: userId,

            user_id: userId,

            title: title.trim(),

            category: category.trim(),

            mode: mode.trim(),

            duration: duration.trim(),

            description: description.trim(),

            prerequisites:
                prerequisites
                    ? prerequisites.trim()
                    : "",

            skill_tags:
                cleanSkills(skill_tags),

            level:
                level
                    ? level.trim()
                    : "",

            status: "draft",

            rejection_reason: "",

            created_at: new Date(),

            updated_at: new Date()

        };


        await db
            .collection("training_programs")
            .insertOne(program);


        return res.status(201).json({

            success: true,

            message:
                "Training program created as Draft.",

            program

        });


    } catch (error) {

        console.error(
            "Create trainer program error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to create training program."

        });

    }

}


// ============================================================
// UPDATE PROGRAM
// ============================================================

async function updateTrainerProgram(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;

        const programId =
            req.params.program_id;


        const existing =
            await db
                .collection("training_programs")
                .findOne({
                    program_id: programId,

                    $or: [
                        { trainer_id: userId },
                        { user_id: userId }
                    ]
                });


        if (!existing) {

            return res.status(404).json({

                success: false,

                message:
                    "Training program not found."

            });

        }


        if (
            existing.status !== "draft" &&
            existing.status !== "rejected"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Only Draft or rejected programs can be edited."

            });

        }


        const {

            title,
            category,
            mode,
            duration,
            description,
            prerequisites,
            skill_tags,
            level

        } = req.body;


        if (!title || !title.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Program title is required."

            });

        }


        if (!category || !category.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Category is required."

            });

        }


        if (!mode || !mode.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Mode is required."

            });

        }


        if (!duration || !duration.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Duration is required."

            });

        }


        if (!description || !description.trim()) {

            return res.status(400).json({

                success: false,

                message:
                    "Description is required."

            });

        }


        await db
            .collection("training_programs")
            .updateOne(
                {
                    program_id: programId,

                    $or: [
                        { trainer_id: userId },
                        { user_id: userId }
                    ]
                },
                {
                    $set: {

                        title: title.trim(),

                        category: category.trim(),

                        mode: mode.trim(),

                        duration: duration.trim(),

                        description:
                            description.trim(),

                        prerequisites:
                            prerequisites
                                ? prerequisites.trim()
                                : "",

                        skill_tags:
                            cleanSkills(skill_tags),

                        level:
                            level
                                ? level.trim()
                                : "",

                        rejection_reason: "",

                        updated_at: new Date()

                    }
                }
            );


        return res.status(200).json({

            success: true,

            message:
                "Training program updated successfully."

        });


    } catch (error) {

        console.error(
            "Update trainer program error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to update training program."

        });

    }

}


// ============================================================
// SUBMIT FOR APPROVAL
// ============================================================

async function submitTrainerProgram(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;

        const programId =
            req.params.program_id;


        const program =
            await db
                .collection("training_programs")
                .findOne({
                    program_id: programId,

                    $or: [
                        { trainer_id: userId },
                        { user_id: userId }
                    ]
                });


        if (!program) {

            return res.status(404).json({

                success: false,

                message:
                    "Training program not found."

            });

        }


        if (
            program.status !== "draft" &&
            program.status !== "rejected"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Only Draft or rejected programs can be submitted."

            });

        }


        await db
            .collection("training_programs")
            .updateOne(
                {
                    program_id: programId
                },
                {
                    $set: {

                        status:
                            "pending_approval",

                        rejection_reason: "",

                        updated_at:
                            new Date()

                    }
                }
            );


        return res.status(200).json({

            success: true,

            message:
                "Training program submitted for approval."

        });


    } catch (error) {

        console.error(
            "Submit trainer program error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to submit training program."

        });

    }

}


// ============================================================
// CLOSE PROGRAM
// ============================================================

async function closeTrainerProgram(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;

        const programId =
            req.params.program_id;


        const program =
            await db
                .collection("training_programs")
                .findOne({
                    program_id: programId,

                    $or: [
                        { trainer_id: userId },
                        { user_id: userId }
                    ]
                });


        if (!program) {

            return res.status(404).json({

                success: false,

                message:
                    "Training program not found."

            });

        }


        if (program.status !== "active") {

            return res.status(400).json({

                success: false,

                message:
                    "Only active programs can be closed."

            });

        }


        await db
            .collection("training_programs")
            .updateOne(
                {
                    program_id: programId
                },
                {
                    $set: {

                        status: "closed",

                        updated_at:
                            new Date()

                    }
                }
            );


        return res.status(200).json({

            success: true,

            message:
                "Training program closed successfully."

        });


    } catch (error) {

        console.error(
            "Close trainer program error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to close training program."

        });

    }

}


module.exports = {

    getTrainerPrograms,

    getTrainerProgram,

    createTrainerProgram,

    updateTrainerProgram,

    submitTrainerProgram,

    closeTrainerProgram

};