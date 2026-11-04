// ============================================================
// NexCraft - Trainer Enrollment Controller
// File: controllers/trainerEnrollmentController.js
// ============================================================

const { getDB } = require("../config/db");
const { issueCertificate } = require("../utils/certificate");
const { notify } = require("../utils/notify");


// ============================================================
// GET TRAINER ENROLLMENTS
// ============================================================

async function getTrainerEnrollments(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;


        if (!userId) {

            return res.status(401).json({
                success: false,
                message: "Authenticated user ID is missing."
            });

        }


        // ----------------------------------------------------
        // Verify Trainer profile
        // ----------------------------------------------------

        const trainer =
            await db
                .collection("trainer_profiles")
                .findOne({
                    user_id: userId
                });


        if (!trainer) {

            return res.status(403).json({
                success: false,
                message: "Trainer profile not found."
            });

        }


        // ----------------------------------------------------
        // Find programs owned by this Trainer
        // ----------------------------------------------------

        const trainerProgramQuery = {
            $or: [
                {
                    trainer_id:
                        trainer.trainer_id
                },
                {
                    trainer_id:
                        userId
                },
                {
                    user_id:
                        userId
                }
            ]
        };


        const programs =
            await db
                .collection("training_programs")
                .find(trainerProgramQuery)
                .toArray();


        // ----------------------------------------------------
        // No programs = no enrollments
        // ----------------------------------------------------

        if (programs.length === 0) {

            return res.status(200).json({
                success: true,
                enrollments: [],
                statistics: {
                    total: 0,
                    enrolled: 0,
                    in_progress: 0,
                    completed: 0
                }
            });

        }


        const programIds =
            programs
                .map(program =>
                    program.program_id
                )
                .filter(Boolean);


        // ----------------------------------------------------
        // Get enrollments belonging to Trainer's programs
        // ----------------------------------------------------

        const enrollments =
            await db
                .collection("enrollments")
                .find({
                    program_id: {
                        $in: programIds
                    }
                })
                .sort({
                    created_at: -1
                })
                .toArray();


        // ----------------------------------------------------
        // Build lookup maps
        // ----------------------------------------------------

        const programMap =
            new Map();


        programs.forEach(program => {

            programMap.set(
                String(program.program_id),
                program
            );

        });


        const learnerIds =
            [
                ...new Set(
                    enrollments
                        .map(
                            enrollment =>
                                enrollment.user_id
                        )
                        .filter(Boolean)
                        .map(
                            id =>
                                String(id)
                        )
                )
            ];


        // ----------------------------------------------------
        // Load Users
        // ----------------------------------------------------

        const users =
            learnerIds.length > 0
                ? await db
                    .collection("users")
                    .find({
                        user_id: {
                            $in: learnerIds
                        }
                    })
                    .project({
                        _id: 0,
                        user_id: 1,
                        email: 1,
                        fullName: 1,
                        name: 1
                    })
                    .toArray()
                : [];


        const userMap =
            new Map();


        users.forEach(user => {

            userMap.set(
                String(user.user_id),
                user
            );

        });


        // ----------------------------------------------------
        // Load learner profiles
        // ----------------------------------------------------

        const learnerProfiles =
            learnerIds.length > 0
                ? await db
                    .collection("learner_profiles")
                    .find({
                        user_id: {
                            $in: learnerIds
                        }
                    })
                    .project({
                        _id: 0,
                        user_id: 1,
                        full_name: 1,
                        profile_image: 1,
                        photo: 1
                    })
                    .toArray()
                : [];


        const learnerProfileMap =
            new Map();


        learnerProfiles.forEach(profile => {

            learnerProfileMap.set(
                String(profile.user_id),
                profile
            );

        });


        

        const result =
            enrollments.map(
                enrollment => {

                    const learnerId =
                        String(
                            enrollment.user_id || ""
                        );


                    const user =
                        userMap.get(
                            learnerId
                        ) || {};


                    const profile =
                        learnerProfileMap.get(
                            learnerId
                        ) || {};


                    const program =
                        programMap.get(
                            String(
                                enrollment.program_id
                            )
                        ) || {};


                    const learnerName =
                        profile.full_name ||
                        user.fullName ||
                        user.name ||
                        "Unknown Learner";


                    const learnerEmail =
                        user.email ||
                        "";


                    const learnerPhoto =
                        profile.profile_image ||
                        profile.photo ||
                        "";


                    return {

                        enrollment_id:
                            enrollment.enrollment_id,

                        user_id:
                            enrollment.user_id,

                        program_id:
                            enrollment.program_id,

                        program_title:
                            program.title ||
                            "Training Program",

                        level:
                            program.level ||
                            "",

                        learner_name:
                            learnerName,

                        learner_email:
                            learnerEmail,

                        learner_photo:
                            learnerPhoto,

                        status:
                            enrollment.status ||
                            "Enrolled",

                        progress:
                            Number(
                                enrollment.progress || 0
                            ),

                        enrolled_at:
                            enrollment.created_at ||
                            enrollment.enrolled_at ||
                            null,

                        created_at:
                            enrollment.created_at ||
                            null,

                        updated_at:
                            enrollment.updated_at ||
                            null,

                        completed_at:
                            enrollment.completed_at ||
                            null

                    };

                }
            );


        // ----------------------------------------------------
        // Statistics
        // ----------------------------------------------------

        const statistics = {

            total:
                result.length,

            enrolled:
                result.filter(
                    item =>
                        normalizeStatus(
                            item.status
                        ) === "enrolled"
                ).length,

            in_progress:
                result.filter(
                    item =>
                        normalizeStatus(
                            item.status
                        ) === "in_progress"
                ).length,

            completed:
                result.filter(
                    item =>
                        normalizeStatus(
                            item.status
                        ) === "completed"
                ).length

        };


        return res.status(200).json({

            success: true,

            enrollments: result,

            statistics

        });


    } catch (error) {

        console.error(
            "Get trainer enrollments error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load trainer enrollments.",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

}


// ============================================================
// UPDATE ENROLLMENT STATUS
// ============================================================

async function updateEnrollmentStatus(req, res) {

    try {

        const db = getDB();

        const userId =
            req.user.user_id;


        const enrollmentId =
            req.params.enrollment_id;


        const requestedStatus =
            req.body.status;


        if (!userId) {

            return res.status(401).json({
                success: false,
                message: "Authenticated user ID is missing."
            });

        }


        if (!enrollmentId) {

            return res.status(400).json({
                success: false,
                message: "Enrollment ID is required."
            });

        }


        if (!requestedStatus) {

            return res.status(400).json({
                success: false,
                message: "Enrollment status is required."
            });

        }


        // ----------------------------------------------------
        // Normalize requested status
        // ----------------------------------------------------

        const newStatus =
            normalizeStatus(
                requestedStatus
            );


        const allowedStatuses = [
            "enrolled",
            "in_progress",
            "completed",
            "dropped"
        ];


        if (
            !allowedStatuses.includes(
                newStatus
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid enrollment status. Allowed statuses are Enrolled, In Progress, Completed and Dropped."

            });

        }


        // ----------------------------------------------------
        // Verify Trainer profile
        // ----------------------------------------------------

        const trainer =
            await db
                .collection("trainer_profiles")
                .findOne({
                    user_id: userId
                });


        if (!trainer) {

            return res.status(403).json({

                success: false,

                message:
                    "Trainer profile not found."

            });

        }


        // ----------------------------------------------------
        // Find enrollment
        // ----------------------------------------------------

        const enrollment =
            await db
                .collection("enrollments")
                .findOne({
                    enrollment_id:
                        enrollmentId
                });


        if (!enrollment) {

            return res.status(404).json({

                success: false,

                message:
                    "Enrollment not found."

            });

        }


        // ----------------------------------------------------
        // Find related training program
        // ----------------------------------------------------

        const program =
            await db
                .collection("training_programs")
                .findOne({

                    program_id:
                        enrollment.program_id,

                    $or: [

                        {
                            trainer_id:
                                trainer.trainer_id
                        },

                        {
                            trainer_id:
                                userId
                        },

                        {
                            user_id:
                                userId
                        }

                    ]

                });


        // ----------------------------------------------------
        // Security check
        // ----------------------------------------------------

        if (!program) {

            return res.status(403).json({

                success: false,

                message:
                    "You are not authorized to update this enrollment."

            });

        }


        // ----------------------------------------------------
        // Current status
        // ----------------------------------------------------

        const currentStatus =
            normalizeStatus(
                enrollment.status
            );


        // ----------------------------------------------------
        // Enforce forward lifecycle
        //
        // Enrolled
        //     ↓
        // In Progress
        //     ↓
        // Completed
        // ----------------------------------------------------

        const validTransition =
            isValidTransition(
                currentStatus,
                newStatus
            );


        if (!validTransition) {

            return res.status(400).json({

                success: false,

                message:
                    `Invalid status transition: ${formatStatus(
                        currentStatus
                    )} → ${formatStatus(
                        newStatus
                    )}.`

            });

        }


        // ----------------------------------------------------
        // Build update
        // ----------------------------------------------------

        const updateFields = {

            status:
                formatDatabaseStatus(
                    newStatus
                ),

            updated_at:
                new Date()

        };


    

        if (
            newStatus === "completed"
        ) {

            updateFields.progress = 100;

            updateFields.completed_at =
                new Date();

        }


        // ----------------------------------------------------
        // Update enrollment
        // ----------------------------------------------------

        const updateResult =
            await db
                .collection("enrollments")
                .updateOne(

                    {
                        enrollment_id:
                            enrollmentId
                    },

                    {
                        $set:
                            updateFields
                    }

                );


        if (
            updateResult.matchedCount === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Enrollment could not be updated."

            });

        }


        // ----------------------------------------------------
        // Return updated enrollment
        // ----------------------------------------------------

        const updatedEnrollment =
            await db
                .collection("enrollments")
                .findOne({
                    enrollment_id:
                        enrollmentId
                });


        // ----------------------------------------------------
        // FR-45: completion issues the certificate  TC-PROG-05: learner notified.
        // ----------------------------------------------------

        let certificate = null;

        if (newStatus === "completed") {
            certificate = await issueCertificate(updatedEnrollment);
        }

        await notify(
            enrollment.user_id,
            "enrollment_status",
            "Enrollment status updated",
            newStatus === "completed"
                ? `Congratulations! You completed "${program.title}". Certificate ${certificate.certificate_number} has been issued.`
                : `Your enrollment in "${program.title}" is now ${formatStatus(newStatus)}.`,
            "/learner/training.html"
        );


        return res.status(200).json({

            success: true,

            message:
                "Enrollment status updated successfully.",

            enrollment:
                updatedEnrollment

        });


    } catch (error) {

        console.error(
            "Update trainer enrollment status error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to update enrollment status.",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

}


// ============================================================
// STATUS HELPERS
// ============================================================

function normalizeStatus(status) {

    if (!status) {
        return "enrolled";
    }


    const value =
        String(status)
            .trim()
            .toLowerCase()
            .replace(
                /[\s-]+/g,
                "_"
            );


    switch (value) {

        case "enrolled":
        case "enrollment":
        case "pending":

            return "enrolled";


        case "in_progress":
        case "inprogress":
        case "active":

            return "in_progress";


        case "completed":
        case "complete":

            return "completed";


        default:

            return value;

    }

}


// ============================================================
// STATUS TRANSITION RULE
// ============================================================

function isValidTransition(
    currentStatus,
    newStatus
) {

    if (
        currentStatus === newStatus
    ) {
        return true;
    }


    if (
        currentStatus === "enrolled" &&
        newStatus === "in_progress"
    ) {
        return true;
    }


    if (
        currentStatus === "in_progress" &&
        newStatus === "completed"
    ) {
        return true;
    }


    // A learner can drop out before completion (FR-16)
    if (
        newStatus === "dropped" &&
        (currentStatus === "enrolled" || currentStatus === "in_progress")
    ) {
        return true;
    }

    return false;

}


// ============================================================
// DATABASE STATUS FORMAT
// ============================================================

function formatDatabaseStatus(status) {

    switch (status) {

        case "enrolled":
            return "Enrolled";

        case "in_progress":
            return "In Progress";

        case "completed":
            return "Completed";

        case "dropped":
            return "Dropped";

        default:
            return status;

    }

}


// ============================================================
// DISPLAY STATUS
// ============================================================

function formatStatus(status) {

    switch (normalizeStatus(status)) {

        case "enrolled":
            return "Enrolled";

        case "in_progress":
            return "In Progress";

        case "completed":
            return "Completed";

        case "dropped":
            return "Dropped";

        default:
            return String(
                status || "Unknown"
            );

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getTrainerEnrollments,

    updateEnrollmentStatus

};