const { getDB } = require("../config/db");
const crypto = require("crypto");
const { notify } = require("../utils/notify");


// Enroll in training
async function enrollInTraining(req, res) {

    try {

        const db = getDB();

        const userId =
            req.user.user_id;

        
        const program_id =
            typeof req.body.program_id === "string"
                ? req.body.program_id.trim()
                : "";


        if (!program_id) {

            return res.status(400).json({
                success: false,
                message: "Program ID is required"
            });

        }


        const user =
            await db.collection("users").findOne({
                user_id: userId
            });


        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }


        const program =
            await db.collection("training_programs")
                .findOne({
                    program_id,
                    status: "active"
                });


        if (!program) {

            return res.status(404).json({
                success: false,
                message: "Training program not found"
            });

        }


        const existing =
            await db.collection("enrollments").findOne({
                user_id: userId,
                program_id
            });


        if (existing) {

            return res.status(409).json({
                success: false,
                message: "You are already enrolled in this program"
            });

        }


        const now = new Date();

        const enrollment = {

            enrollment_id:
                `ENR-${crypto.randomUUID()}`,

            user_id: userId,

            program_id,

            progress: 0,

            status: "Enrolled",

            enrolled_at: now,

            updated_at: now

        };


        await db.collection("enrollments")
            .insertOne(enrollment);

        // TC-PROG-03: Trainer and Learner notified
        await notify(
            userId,
            "enrollment_status",
            "Enrollment confirmed",
            `You are enrolled in "${program.title}".`,
            "/learner/training.html"
        );

        await notify(
            program.trainer_id || program.user_id,
            "enrollment_status",
            "New enrollment",
            `${user.name} enrolled in "${program.title}".`,
            "/trainer/enrollments.html"
        );


        return res.status(201).json({

            success: true,

            message:
                "Successfully enrolled in training program",

            enrollment

        });


    } catch (error) {

        console.error(
            "Enroll training error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to enroll in training program"
        });

    }

}



// Get learner enrollments
async function getMyEnrollments(req, res) {

    try {

        const db = getDB();

        const userId =
            req.user.user_id;


        const enrollments =
            await db.collection("enrollments")
                .find({
                    user_id: userId
                })
                .sort({
                    enrolled_at: -1
                })
                .toArray();


        const programIds =
            enrollments.map(
                item => item.program_id
            );


        let programs = [];


        if (programIds.length > 0) {

            programs =
                await db.collection("training_programs")
                    .find({
                        program_id: {
                            $in: programIds
                        }
                    })
                    .toArray();

        }


        const programMap = {};


        programs.forEach(program => {

            programMap[
                program.program_id
            ] = program;

        });


        const result =
            enrollments.map(enrollment => ({

                ...enrollment,

                program:
                    programMap[
                        enrollment.program_id
                    ] || null

            }));


        return res.status(200).json({

            success: true,

            enrollments: result

        });


    } catch (error) {

        console.error(
            "Get enrollments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load enrollments"
        });

    }

}



// Update progress (learner self-tracking)

async function updateProgress(req, res) {

    try {

        const db = getDB();
        const userId = req.user.user_id;
        const { enrollment_id } = req.params;
        const progress = Number(req.body.progress);

        if (Number.isNaN(progress) || progress < 0 || progress > 99) {
            return res.status(400).json({
                success: false,
                message:
                    "Progress must be between 0 and 99. Your trainer marks the program as completed."
            });
        }

        const enrollment = await db.collection("enrollments").findOne({
            enrollment_id,
            user_id: userId
        });

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: "Enrollment not found"
            });
        }

        if (["Completed", "Dropped"].includes(enrollment.status)) {
            return res.status(400).json({
                success: false,
                message: `This enrollment is already ${enrollment.status.toLowerCase()}`
            });
        }

        const update = {
            progress,
            status: progress > 0 ? "In Progress" : enrollment.status,
            updated_at: new Date()
        };

        await db.collection("enrollments").updateOne(
            { enrollment_id, user_id: userId },
            { $set: update }
        );

        return res.status(200).json({
            success: true,
            message: "Training progress updated",
            enrollment: { ...enrollment, ...update }
        });

    } catch (error) {

        console.error("Update progress error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update training progress"
        });
    }
}



module.exports = {

    enrollInTraining,

    getMyEnrollments,

    updateProgress

};