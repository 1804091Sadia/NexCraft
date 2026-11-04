const { getDB } = require("../config/db");
const { escapeRegex, str } = require("../utils/constants");

// FR-11: filter by keyword, category, employment type, location, skill, salary.
function buildJobFilter(query) {
    const filter = { status: "active" };
    const q = str(query.q, 80);
    const category = str(query.category, 80);
    const jobType = str(query.job_type, 30);
    const location = str(query.location, 80);
    const skill = str(query.skill, 40);
    const salaryMin = Number(query.salary_min);

    if (q) {
        const pattern = { $regex: escapeRegex(q), $options: "i" };
        filter.$or = [{ title: pattern }, { company: pattern }, { description: pattern }];
    }
    if (category) filter.category = category;
    if (jobType) filter.job_type = jobType;
    if (location) filter.location = { $regex: escapeRegex(location), $options: "i" };
    if (skill) filter.skill_tags = { $regex: `^${escapeRegex(skill)}$`, $options: "i" };
    if (Number.isFinite(salaryMin) && salaryMin > 0) filter.salary_max = { $gte: salaryMin };

    return filter;
}


// Get jobs
async function getJobs(req, res) {

    try {

        const db = getDB();

        const jobs = await db
            .collection("jobs")
            .find(buildJobFilter(req.query))
            .project({ _id: 0 })
            .sort({
                created_at: -1
            })
            .toArray();


        return res.status(200).json({
            success: true,
            jobs
        });

    } catch (error) {

        console.error(
            "Get jobs error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load jobs"
        });
    }
}


// Get one job
async function getJobById(req, res) {

    try {

        const db = getDB();

        const { id } = req.params;


        const job = await db
            .collection("jobs")
            .findOne({
                job_id: id,
                status: "active"
            });


        if (!job) {

            return res.status(404).json({
                success: false,
                message: "Job not found"
            });

        }


        return res.status(200).json({
            success: true,
            job
        });

    } catch (error) {

        console.error(
            "Get job error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load job"
        });
    }
}


module.exports = {
    getJobs,
    getJobById
};