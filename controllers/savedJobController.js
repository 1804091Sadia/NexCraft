const { getDB } = require("../config/db");

// Save a job
async function saveJob(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        
        const job_id =
            typeof req.body.job_id === "string" ? req.body.job_id.trim() : "";

        if (!job_id) {
            return res.status(400).json({
                success: false,
                message: "Job ID is required"
            });
        }

        // Check user
        const user = await db.collection("users").findOne({
            user_id: userId
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check job
        const job = await db.collection("jobs").findOne({
            job_id: job_id,
            status: "active"
        });

        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found or no longer active"
            });
        }

        // Check if already saved
        const existingSavedJob = await db.collection("saved_jobs").findOne({
            user_id: userId,
            job_id: job_id
        });

        if (existingSavedJob) {
            return res.status(409).json({
                success: false,
                message: "Job is already saved"
            });
        }

        const savedJob = {
            user_id: userId,
            job_id: job_id,
            created_at: new Date()
        };

        await db.collection("saved_jobs").insertOne(savedJob);

        return res.status(201).json({
            success: true,
            message: "Job saved successfully",
            savedJob
        });

    } catch (error) {
        console.error("Save job error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save job"
        });
    }
}


// Get learner's saved jobs
async function getSavedJobs(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;

        const savedJobs = await db.collection("saved_jobs")
            .find({
                user_id: userId
            })
            .sort({
                created_at: -1
            })
            .toArray();

        const jobIds = savedJobs.map(item => item.job_id);

        let jobs = [];

        if (jobIds.length > 0) {
            jobs = await db.collection("jobs")
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

        const result = savedJobs.map(savedJob => ({
            ...savedJob,
            job: jobMap[savedJob.job_id] || null
        }));

        return res.status(200).json({
            success: true,
            savedJobs: result
        });

    } catch (error) {
        console.error("Get saved jobs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load saved jobs"
        });
    }
}


// Remove saved job
async function removeSavedJob(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        const { job_id } = req.params;

        const result = await db.collection("saved_jobs").deleteOne({
            user_id: userId,
            job_id: job_id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Saved job not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Job removed from saved jobs"
        });

    } catch (error) {
        console.error("Remove saved job error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove saved job"
        });
    }
}


// Check whether one job is saved
async function checkSavedJob(req, res) {
    try {
        const db = getDB();
        const userId = req.user.user_id;
        const { job_id } = req.params;

        const savedJob = await db.collection("saved_jobs").findOne({
            user_id: userId,
            job_id: job_id
        });

        return res.status(200).json({
            success: true,
            saved: !!savedJob
        });

    } catch (error) {
        console.error("Check saved job error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to check saved job"
        });
    }
}


module.exports = {
    saveJob,
    getSavedJobs,
    removeSavedJob,
    checkSavedJob
};