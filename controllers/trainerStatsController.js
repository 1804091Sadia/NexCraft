const { getDB } = require("../config/db");

function normalizeStatus(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

/*
    Trainer Statistics Controller
    --------------------------------
    Provides:
    - Total programs
    - Draft programs
    - Pending approval programs
    - Active programs
    - Closed programs
    - Total enrollments
    - Enrolled learners
    - In-progress learners
    - Completed learners
    - Enrollment count for each program

*/

async function getTrainerStats(req, res) {
    try {
        const db = getDB();

        const userId = req.user.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User authentication information is missing."
            });
        }

        // -----------------------------------------
        // 1. Find trainer profile
        // -----------------------------------------

        const trainer = await db
            .collection("trainer_profiles")
            .findOne({
                user_id: userId
            });

        if (!trainer) {
            return res.status(404).json({
                success: false,
                message: "Trainer profile not found."
            });
        }

        

        const trainerConditions = [
            {
                trainer_id: trainer.trainer_id
            },
            {
                trainer_id: userId
            },
            {
                user_id: userId
            }
        ];

        // Remove undefined values
        const validConditions = trainerConditions.filter(
            condition =>
                Object.values(condition)[0] !== undefined &&
                Object.values(condition)[0] !== null
        );

        // -----------------------------------------
        // 2. Find trainer's programs
        // -----------------------------------------

        const programs = await db
            .collection("training_programs")
            .find({
                $or: validConditions
            })
            .sort({
                created_at: -1
            })
            .toArray();

        const programIds = programs
            .map(program => program.program_id)
            .filter(id => id !== undefined && id !== null);

        // -----------------------------------------
        // 3. Find enrollments
        // -----------------------------------------

        let enrollments = [];

        if (programIds.length > 0) {
            enrollments = await db
                .collection("enrollments")
                .find({
                    program_id: {
                        $in: programIds
                    }
                })
                .toArray();
        }

        // -----------------------------------------
        // 4. Program statistics
        // -----------------------------------------

        const programStats = {
            total: programs.length,
            draft: 0,
            pendingApproval: 0,
            active: 0,
            rejected: 0,
            closed: 0
        };

        programs.forEach(program => {
            const status = normalizeStatus(program.status);

            if (status === "draft") {
                programStats.draft++;
            } else if (
                status === "pending approval" ||
                status === "pending approval status" ||
                status.includes("pending") && status.includes("approval")
            ) {
                programStats.pendingApproval++;
            } else if (status === "active") {
                programStats.active++;
            } else if (status === "rejected") {
                programStats.rejected++;
            } else if (status === "closed") {
                programStats.closed++;
            }
        });

        // -----------------------------------------
        // 5. Enrollment statistics
        // -----------------------------------------

        const enrollmentStats = {
            total: enrollments.length,
            enrolled: 0,
            inProgress: 0,
            completed: 0,
            dropped: 0
        };

        enrollments.forEach(enrollment => {
            const status = normalizeStatus(enrollment.status);

            if (
                status === "enrolled" ||
                status === "pending"
            ) {
                enrollmentStats.enrolled++;
            } else if (
                status === "in progress" ||
                status.includes("in progress") ||
                status === "active"
            ) {
                enrollmentStats.inProgress++;
            } else if (status === "completed") {
                enrollmentStats.completed++;
            } else if (status === "dropped") {
                enrollmentStats.dropped++;
            }
        });

        // -----------------------------------------
        // 6. Enrollment count per program
        // -----------------------------------------

        const programEnrollmentCounts = programs.map(
            program => {
                const programEnrollments =
                    enrollments.filter(
                        enrollment =>
                            String(
                                enrollment.program_id
                            ) ===
                            String(
                                program.program_id
                            )
                    );

                return {
                    program_id: program.program_id,
                    title: program.title || "Untitled Program",
                    status: program.status || "Draft",
                    enrollment_count:
                        programEnrollments.length
                };
            }
        );

        // -----------------------------------------
        // 7. Return response
        // -----------------------------------------

        return res.status(200).json({
            success: true,

            statistics: {
                programs: programStats,
                enrollments: enrollmentStats
            },

            programEnrollmentCounts
        });

    } catch (error) {
        console.error(
            "Trainer statistics error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load trainer statistics.",
            error: error.message
        });
    }
}

module.exports = {
    getTrainerStats
};