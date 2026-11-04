const { getDB } = require("../config/db");
const crypto = require("crypto");
const { notify } = require("../utils/notify");

const APPLICATION_STATUSES = [
    "Received",
    "Under Review",
    "Shortlisted",
    "Interview Scheduled",
    "Outcome Pending",
    "Placed",
    "Not Progressed",
    "Withdrawn"
];

const TERMINAL_STATUSES = ["Placed", "Not Progressed", "Withdrawn"];

// Human-readable unique reference, e.g. APP-2026-7F3A9C (TC-JOB-04)
function generateReferenceNo() {
    return `APP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}


// Create application
async function createApplication(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;

        
        const job_id =
            typeof req.body.job_id === "string" ? req.body.job_id.trim() : "";

        const cover_letter =
            typeof req.body.cover_letter === "string"
                ? req.body.cover_letter.trim().slice(0, 5000)
                : "";


        // Validate job ID
        if (!job_id) {

            return res.status(400).json({
                success: false,
                message: "Job ID is required"
            });
        }


        // Find user
        const user = await db.collection("users").findOne({
            user_id: userId
        });


        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // Check learner profile
        const profile =
            await db.collection("learner_profiles").findOne({
                user_id: userId
            });


        if (!profile) {

            return res.status(400).json({
                success: false,
                message: "Please complete your learner profile before applying"
            });
        }


        // CV for application
        if (!profile.cv) {

            return res.status(400).json({
                success: false,
                message: "Please upload your CV before applying"
            });
        }


        // Check job
        const job =
            await db.collection("jobs").findOne({
                job_id: job_id,
                status: "active"
            });


        if (!job) {

            return res.status(404).json({
                success: false,
                message: "Job not found or no longer active"
            });
        }


        // Prevent duplicate application
        const existingApplication =
            await db.collection("applications").findOne({
                user_id: userId,
                job_id: job_id
            });


        if (existingApplication) {

            return res.status(409).json({
                success: false,
                message: "You have already applied for this job"
            });
        }


        // Create application ID
        const applicationId =
            `APP-${crypto.randomUUID()}`;


        const now = new Date();


        const application = {

            application_id: applicationId,

            reference_no: generateReferenceNo(),

            user_id: userId,

            job_id: job_id,

            cover_letter:
                cover_letter || "",

            cv: profile.cv,

            status: "Received",

            status_history: [
                { status: "Received", changed_at: now, changed_by: userId }
            ],

            created_at: now,

            updated_at: now

        };


        await db.collection("applications")
            .insertOne(application);

        // TC-JOB-04: Employer and Learner notified
        await notify(
            userId,
            "application_status",
            "Application received",
            `Your application for "${job.title}" was submitted. Reference: ${application.reference_no}.`,
            "/learner/applications.html"
        );

        await notify(
            job.employer_id || job.user_id,
            "application_status",
            "New application",
            `${user.name} applied for "${job.title}".`,
            "/employer/dashboard.html"
        );


        return res.status(201).json({

            success: true,

            message: "Application submitted successfully",

            application: application

        });


    } catch (error) {

        console.error(
            "Create application error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Failed to submit application"

        });
    }
}



// Get learner applications
async function getApplications(req, res) {

    try {

        const db = getDB();

        const userId = req.user.user_id;


        const applications =
            await db.collection("applications")
                .find({
                    user_id: userId
                })
                .sort({
                    created_at: -1
                })
                .toArray();


        // Attach job information
        const jobIds =
            applications.map(
                application =>
                    application.job_id
            );


        let jobs = [];


        if (jobIds.length > 0) {

            jobs =
                await db.collection("jobs")
                    .find({
                        job_id: {
                            $in: jobIds
                        }
                    })
                    .toArray();
        }


        const jobMap = {};

        jobs.forEach(job => {

            jobMap[job.job_id] = job;

        });


        const result =
            applications.map(application => ({

                ...application,

                job:
                    jobMap[application.job_id] || null

            }));


        return res.status(200).json({

            success: true,

            applications: result

        });


    } catch (error) {

        console.error(
            "Get applications error:",
            error
        );


        return res.status(500).json({

            success: false,

            message: "Failed to load applications"

        });
    }
}


// Withdraw application (FR-37, TC-JOB-06)
// PATCH /api/applications/:application_id/withdraw
async function withdrawApplication(req, res) {

    try {

        const db = getDB();
        const userId = req.user.user_id;
        const { application_id } = req.params;

        const application = await db.collection("applications").findOne({
            application_id,
            user_id: userId
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        if (TERMINAL_STATUSES.includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: `This application is already ${application.status} and cannot be withdrawn`
            });
        }

        const now = new Date();

        await db.collection("applications").updateOne(
            { application_id, user_id: userId },
            {
                $set: { status: "Withdrawn", updated_at: now },
                $push: {
                    status_history: {
                        status: "Withdrawn",
                        changed_at: now,
                        changed_by: userId
                    }
                }
            }
        );

        const job = await db.collection("jobs").findOne({ job_id: application.job_id });

        if (job) {
            await notify(
                job.employer_id || job.user_id,
                "application_status",
                "Application withdrawn",
                `An applicant withdrew from "${job.title}" (${application.reference_no || application_id}).`,
                "/employer/dashboard.html"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Application withdrawn"
        });

    } catch (error) {

        console.error("Withdraw application error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to withdraw application"
        });
    }
}


module.exports = {
    createApplication,
    getApplications,
    withdrawApplication,
    APPLICATION_STATUSES,
    TERMINAL_STATUSES
};