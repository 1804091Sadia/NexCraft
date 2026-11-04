// ============================================================
// EMPLOYER MODULE  (FR-22, 23, 24, 25, 40, 41)
// Routes: routes/employerRoutes.js  (all require role "Employer")
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");
const { notify } = require("../utils/notify");
const {
    LISTING_STATUS,
    APPLICATION_FLOW,
    APPLICATION_TERMINAL,
    JOB_TYPES,
    escapeRegex,
    str
} = require("../utils/constants");

function fail(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function serverError(res, label, error) {
    console.error(`${label}:`, error);
    return fail(res, 500, "Something went wrong. Please try again.");
}

function toSkillArray(value) {
    const list = Array.isArray(value)
        ? value
        : typeof value === "string" ? value.split(",") : [];

    return [...new Set(
        list
            .filter(item => typeof item === "string")
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => item.slice(0, 40))
    )].slice(0, 20);
}

function toMoney(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : NaN;
}


// ============================================================
// PROFILE  (FR-22)
// ============================================================

async function getProfile(req, res) {
    try {
        const profile = await getDB().collection("employer_profiles").findOne(
            { user_id: req.user.user_id },
            { projection: { _id: 0 } }
        );

        return res.json({ success: true, profile: profile || null });

    } catch (error) {
        return serverError(res, "Get employer profile error", error);
    }
}

async function saveProfile(req, res) {
    try {
        const company_name = str(req.body.company_name, 120);
        const contact_phone = str(req.body.contact_phone, 30);
        const website = str(req.body.website, 200);
        const industry = str(req.body.industry, 80);
        const location = str(req.body.location, 120);
        const description = str(req.body.description, 2000);

        if (!company_name) {
            return fail(res, 400, "Company name is required");
        }

        if (!contact_phone || !/^[+\d][\d\s()-]{5,}$/.test(contact_phone)) {
            return fail(res, 400, "Please enter a valid contact phone number");
        }

        if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) {
            return fail(res, 400, "Website must start with http:// or https://");
        }

        const now = new Date();
        const db = getDB();

        await db.collection("employer_profiles").updateOne(
            { user_id: req.user.user_id },
            {
                $set: {
                    company_name, contact_phone, website, industry,
                    location, description, updated_at: now
                },
                $setOnInsert: { user_id: req.user.user_id, created_at: now }
            },
            { upsert: true }
        );

        
        await db.collection("jobs").updateMany(
            { employer_id: req.user.user_id },
            { $set: { company: company_name, company_name } }
        );

        return res.json({ success: true, message: "Company profile saved" });

    } catch (error) {
        return serverError(res, "Save employer profile error", error);
    }
}


// ============================================================
// DASHBOARD
// ============================================================

async function getDashboard(req, res) {
    try {
        const db = getDB();
        const employerId = req.user.user_id;

        const [profile, jobs] = await Promise.all([
            db.collection("employer_profiles").findOne({ user_id: employerId }),
            db.collection("jobs")
                .find({ employer_id: employerId })
                .project({ _id: 0, job_id: 1, title: 1, status: 1 })
                .toArray()
        ]);

        const jobIds = jobs.map(job => job.job_id);
        const titles = Object.fromEntries(jobs.map(job => [job.job_id, job.title]));

        const applications = jobIds.length
            ? await db.collection("applications")
                .find({ job_id: { $in: jobIds }, status: { $ne: "Withdrawn" } })
                .sort({ created_at: -1 })
                .toArray()
            : [];

        const jobCounts = { draft: 0, pending_approval: 0, active: 0, rejected: 0, closed: 0 };
        jobs.forEach(job => {
            if (job.status in jobCounts) jobCounts[job.status]++;
        });

        const applicantIds = applications.slice(0, 5).map(a => a.user_id);
        const applicants = applicantIds.length
            ? await db.collection("users")
                .find({ user_id: { $in: applicantIds } })
                .project({ _id: 0, user_id: 1, name: 1 })
                .toArray()
            : [];
        const names = Object.fromEntries(applicants.map(u => [u.user_id, u.name]));

        return res.json({
            success: true,
            hasProfile: Boolean(profile),
            company_name: profile?.company_name || "",
            jobs: { total: jobs.length, ...jobCounts },
            applications: {
                total: applications.length,
                new: applications.filter(a => a.status === "Received").length,
                shortlisted: applications.filter(a => a.status === "Shortlisted").length,
                placed: applications.filter(a => a.status === "Placed").length
            },
            recentApplications: applications.slice(0, 5).map(a => ({
                application_id: a.application_id,
                reference_no: a.reference_no,
                applicant_name: names[a.user_id] || "Applicant",
                job_title: titles[a.job_id] || "Job",
                status: a.status,
                created_at: a.created_at
            }))
        });

    } catch (error) {
        return serverError(res, "Employer dashboard error", error);
    }
}


// ============================================================
// JOB POSTINGS  (FR-23, FR-24)
// ============================================================

function readJobInput(body) {
    const job = {
        title: str(body.title, 120),
        category: str(body.category, 80),
        job_type: str(body.job_type, 30),
        location: str(body.location, 120),
        salary_min: toMoney(body.salary_min),
        salary_max: toMoney(body.salary_max),
        description: str(body.description, 5000),
        requirements: str(body.requirements, 3000),
        responsibilities: str(body.responsibilities, 3000),
        skill_tags: toSkillArray(body.skill_tags)
    };

    if (!job.title) return { error: "Job title is required" };
    if (!job.category) return { error: "Category is required" };
    if (!JOB_TYPES.includes(job.job_type)) {
        return { error: `Employment type must be one of: ${JOB_TYPES.join(", ")}` };
    }
    if (!job.location) return { error: "Location is required" };
    if (Number.isNaN(job.salary_min) || Number.isNaN(job.salary_max)) {
        return { error: "Salary must be a positive number" };
    }
    if (job.salary_min !== null && job.salary_max !== null && job.salary_min > job.salary_max) {
        return { error: "Minimum salary cannot be higher than maximum salary" };
    }
    if (job.description.length < 30) {
        return { error: "Description must be at least 30 characters" };
    }

    return { job };
}

async function findOwnJob(req) {
    return getDB().collection("jobs").findOne({
        job_id: str(req.params.job_id, 80),
        employer_id: req.user.user_id
    });
}

async function listJobs(req, res) {
    try {
        const db = getDB();
        const filter = { employer_id: req.user.user_id };
        const status = str(req.query.status, 30);
        if (status) filter.status = status;

        const jobs = await db.collection("jobs")
            .find(filter)
            .project({ _id: 0 })
            .sort({ updated_at: -1 })
            .toArray();

        const counts = jobs.length
            ? await db.collection("applications").aggregate([
                {
                    $match: {
                        job_id: { $in: jobs.map(j => j.job_id) },
                        status: { $ne: "Withdrawn" }
                    }
                },
                { $group: { _id: "$job_id", count: { $sum: 1 } } }
            ]).toArray()
            : [];

        const countByJob = Object.fromEntries(counts.map(c => [c._id, c.count]));

        return res.json({
            success: true,
            jobs: jobs.map(job => ({ ...job, application_count: countByJob[job.job_id] || 0 }))
        });

    } catch (error) {
        return serverError(res, "List employer jobs error", error);
    }
}

async function getJob(req, res) {
    try {
        const job = await findOwnJob(req);
        if (!job) return fail(res, 404, "Job not found");

        delete job._id;
        return res.json({ success: true, job });

    } catch (error) {
        return serverError(res, "Get employer job error", error);
    }
}

async function notifyAdmins(title, body, link) {
    const admins = await getDB().collection("users")
        .find({ roles: "Admin", status: "active" })
        .project({ user_id: 1 })
        .toArray();

    await Promise.all(admins.map(a => notify(a.user_id, "approval", title, body, link)));
}

async function createJob(req, res) {
    try {
        const db = getDB();

        const profile = await db.collection("employer_profiles").findOne({
            user_id: req.user.user_id
        });

        if (!profile) {
            return fail(res, 400, "Please complete your company profile before posting a job");
        }

        const { job, error } = readJobInput(req.body);
        if (error) return fail(res, 400, error);

        const submitNow = req.body.submit === true || req.body.submit === "true";
        const now = new Date();

        const document = {
            job_id: `JOB-${crypto.randomUUID()}`,
            employer_id: req.user.user_id,
            user_id: req.user.user_id,
            company: profile.company_name,
            company_name: profile.company_name,
            ...job,
            status: submitNow ? LISTING_STATUS.PENDING : LISTING_STATUS.DRAFT,
            rejection_reason: "",
            submitted_at: submitNow ? now : null,
            created_at: now,
            updated_at: now
        };

        await db.collection("jobs").insertOne(document);

        if (submitNow) {
            await notify(req.user.user_id, "approval", "Job submitted for approval",
                `"${job.title}" is waiting for Admin review.`, "/employer/jobs.html");
            await notifyAdmins("New job to review", `"${job.title}" by ${profile.company_name}`,
                "/admin/approvals.html");
        }

        delete document._id;

        return res.status(201).json({
            success: true,
            message: submitNow ? "Job submitted for approval" : "Job saved as draft",
            job: document
        });

    } catch (error) {
        return serverError(res, "Create job error", error);
    }
}

async function updateJob(req, res) {
    try {
        const existing = await findOwnJob(req);
        if (!existing) return fail(res, 404, "Job not found");

        if (![LISTING_STATUS.DRAFT, LISTING_STATUS.REJECTED].includes(existing.status)) {
            return fail(res, 400, "Only Draft or Rejected jobs can be edited");
        }

        const { job, error } = readJobInput(req.body);
        if (error) return fail(res, 400, error);

        await getDB().collection("jobs").updateOne(
            { job_id: existing.job_id },
            { $set: { ...job, updated_at: new Date() } }
        );

        return res.json({ success: true, message: "Job updated" });

    } catch (error) {
        return serverError(res, "Update job error", error);
    }
}

async function submitJob(req, res) {
    try {
        const job = await findOwnJob(req);
        if (!job) return fail(res, 404, "Job not found");

        if (![LISTING_STATUS.DRAFT, LISTING_STATUS.REJECTED].includes(job.status)) {
            return fail(res, 400, "Only Draft or Rejected jobs can be submitted");
        }

        const now = new Date();

        await getDB().collection("jobs").updateOne(
            { job_id: job.job_id },
            { $set: { status: LISTING_STATUS.PENDING, submitted_at: now, updated_at: now } }
        );

        await notify(req.user.user_id, "approval", "Job submitted for approval",
            `"${job.title}" is waiting for Admin review.`, "/employer/jobs.html");
        await notifyAdmins("New job to review", `"${job.title}" by ${job.company}`,
            "/admin/approvals.html");

        return res.json({ success: true, message: "Job submitted for approval" });

    } catch (error) {
        return serverError(res, "Submit job error", error);
    }
}

async function closeJob(req, res) {
    try {
        const job = await findOwnJob(req);
        if (!job) return fail(res, 404, "Job not found");

        if (job.status !== LISTING_STATUS.ACTIVE) {
            return fail(res, 400, "Only Active jobs can be closed");
        }

        const now = new Date();

        await getDB().collection("jobs").updateOne(
            { job_id: job.job_id },
            { $set: { status: LISTING_STATUS.CLOSED, closed_at: now, updated_at: now } }
        );

        return res.json({ success: true, message: "Job closed. It no longer accepts applications." });

    } catch (error) {
        return serverError(res, "Close job error", error);
    }
}

async function deleteDraftJob(req, res) {
    try {
        const job = await findOwnJob(req);
        if (!job) return fail(res, 404, "Job not found");

        if (job.status !== LISTING_STATUS.DRAFT) {
            return fail(res, 400, "Only drafts can be deleted. Close an active job instead.");
        }

        await getDB().collection("jobs").deleteOne({ job_id: job.job_id });

        return res.json({ success: true, message: "Draft deleted" });

    } catch (error) {
        return serverError(res, "Delete job error", error);
    }
}


// ============================================================
// APPLICATIONS  (FR-40, FR-41)
// ============================================================

async function attachApplicants(applications) {
    const db = getDB();
    const userIds = [...new Set(applications.map(a => a.user_id))];
    const jobIds = [...new Set(applications.map(a => a.job_id))];

    const [users, profiles, jobs] = await Promise.all([
        db.collection("users").find({ user_id: { $in: userIds } })
            .project({ _id: 0, user_id: 1, name: 1, email: 1 }).toArray(),
        db.collection("learner_profiles").find({ user_id: { $in: userIds } })
            .project({ _id: 0, user_id: 1, track: 1, skills: 1, skill_levels: 1, location: 1,
                profile_image: 1, cv: 1, phone: 1, education: 1, career: 1, bio: 1,
                employment_status: 1, experience_level: 1 }).toArray(),
        db.collection("jobs").find({ job_id: { $in: jobIds } })
            .project({ _id: 0, job_id: 1, title: 1 }).toArray()
    ]);

    const byUser = Object.fromEntries(users.map(u => [u.user_id, u]));
    const byProfile = Object.fromEntries(profiles.map(p => [p.user_id, p]));
    const byJob = Object.fromEntries(jobs.map(j => [j.job_id, j]));

    return applications.map(a => {
        const profile = byProfile[a.user_id] || {};
        return {
            application_id: a.application_id,
            reference_no: a.reference_no || a.application_id,
            job_id: a.job_id,
            job_title: byJob[a.job_id]?.title || "Job",
            user_id: a.user_id,
            applicant_name: byUser[a.user_id]?.name || "Applicant",
            applicant_email: byUser[a.user_id]?.email || "",
            track: profile.track || "",
            skills: profile.skills || [],
            skill_levels: profile.skill_levels || {},
            employment_status: profile.employment_status || "",
            experience_level: profile.experience_level || "",
            employer_rating: a.employer_rating || null,
            location: profile.location || "",
            education: profile.education || "",
            career: profile.career || "",
            bio: profile.bio || "",
            profile_image: profile.profile_image || null,
            has_cv: Boolean(a.cv || profile.cv),
            cover_letter: a.cover_letter || "",
            status: a.status,
            status_history: a.status_history || [],
            created_at: a.created_at,
            updated_at: a.updated_at
        };
    });
}

// GET /api/employers/applications?job_id=&status=
async function listApplications(req, res) {
    try {
        const db = getDB();

        const myJobs = await db.collection("jobs")
            .find({ employer_id: req.user.user_id })
            .project({ job_id: 1 })
            .toArray();

        let jobIds = myJobs.map(j => j.job_id);
        const jobFilter = str(req.query.job_id, 80);

        if (jobFilter) {
            if (!jobIds.includes(jobFilter)) return fail(res, 404, "Job not found");
            jobIds = [jobFilter];
        }

        const status = str(req.query.status, 40);

        // TC-JOB-06: withdrawn applications leave the active queue
        const filter = {
            job_id: { $in: jobIds },
            status: status ? status : { $ne: "Withdrawn" }
        };

        const applications = jobIds.length
            ? await db.collection("applications").find(filter).sort({ created_at: -1 }).toArray()
            : [];

        return res.json({
            success: true,
            flow: [...APPLICATION_FLOW, "Not Progressed"],
            applications: await attachApplicants(applications)
        });

    } catch (error) {
        return serverError(res, "List employer applications error", error);
    }
}

async function findOwnApplication(req) {
    const db = getDB();

    const application = await db.collection("applications").findOne({
        application_id: str(req.params.application_id, 80)
    });

    if (!application) return null;

    const job = await db.collection("jobs").findOne({
        job_id: application.job_id,
        employer_id: req.user.user_id
    });

    return job ? { application, job } : null;
}


function allowedNextStatuses(current) {
    if (APPLICATION_TERMINAL.includes(current)) return [];
    const index = APPLICATION_FLOW.indexOf(current);
    return [...APPLICATION_FLOW.slice(index + 1), "Not Progressed"];
}

// PATCH /api/employers/applications/:application_id/status  { status, note }
async function updateApplicationStatus(req, res) {
    try {
        const found = await findOwnApplication(req);
        if (!found) return fail(res, 404, "Application not found");

        const { application, job } = found;
        const newStatus = str(req.body.status, 40);
        const note = str(req.body.note, 500);

        const allowed = allowedNextStatuses(application.status);

        if (!allowed.includes(newStatus)) {
            return fail(res, 400, allowed.length
                ? `From "${application.status}" you can move to: ${allowed.join(", ")}`
                : `This application is ${application.status} and can no longer change`);
        }

        const now = new Date();

        await getDB().collection("applications").updateOne(
            { application_id: application.application_id },
            {
                $set: { status: newStatus, updated_at: now },
                $push: {
                    status_history: {
                        status: newStatus, note, changed_at: now, changed_by: req.user.user_id
                    }
                }
            }
        );

        // FR-40: each status change notifies the learner
        await notify(
            application.user_id,
            "application_status",
            `Application update: ${newStatus}`,
            `Your application for "${job.title}" at ${job.company} is now ${newStatus}.` +
                (note ? ` Note: ${note}` : ""),
            "/learner/applications.html"
        );

        return res.json({
            success: true,
            message: `Status changed to ${newStatus}`,
            status: newStatus,
            next: allowedNextStatuses(newStatus)
        });

    } catch (error) {
        return serverError(res, "Update application status error", error);
    }
}


// PATCH /api/employers/applications/:application_id/rating  { rating: 1-5 }
async function rateApplicant(req, res) {
    try {
        const found = await findOwnApplication(req);
        if (!found) return fail(res, 404, "Application not found");

        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return fail(res, 400, "Rating must be a whole number from 1 to 5");
        }

        if (["Received", "Withdrawn"].includes(found.application.status)) {
            return fail(res, 400, "Review the application before rating the candidate");
        }

        await getDB().collection("applications").updateOne(
            { application_id: found.application.application_id },
            { $set: { employer_rating: rating, rated_at: new Date() } }
        );

        return res.json({ success: true, message: `Rated ${rating} out of 5` });

    } catch (error) {
        return serverError(res, "Rate applicant error", error);
    }
}

async function ratingsFor(userIds = null) {
    const filter = { employer_rating: { $gte: 1 } };
    if (userIds) filter.user_id = { $in: userIds };

    const rows = await getDB().collection("applications")
        .find(filter)
        .project({ _id: 0, user_id: 1, employer_rating: 1 })
        .toArray();

    const totals = {};
    for (const row of rows) {
        totals[row.user_id] = totals[row.user_id] || { total: 0, count: 0 };
        totals[row.user_id].total += row.employer_rating;
        totals[row.user_id].count += 1;
    }

    return Object.fromEntries(Object.entries(totals).map(([id, t]) => [id, {
        avg: Math.round((t.total / t.count) * 10) / 10,
        count: t.count
    }]));
}


// ============================================================
// CANDIDATES  (FR-25)
// ============================================================

async function searchCandidates(req, res) {
    try {
        const db = getDB();
        const pageSize = 12;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const filter = {};
        const track = str(req.query.track, 60);
        const skill = str(req.query.skill, 40);
        const badge = str(req.query.badge, 60);
        const q = str(req.query.q, 60);

        if (track) filter.track = { $regex: escapeRegex(track), $options: "i" };
        if (skill) filter.skills = { $regex: `^${escapeRegex(skill)}$`, $options: "i" };

        if (badge) {
            const holders = await db.collection("learner_badges")
                .find({ $or: [{ name: badge }, { title: badge }, { badge_id: badge }] })
                .project({ user_id: 1 })
                .toArray();
            filter.user_id = { $in: holders.map(h => h.user_id) };
        }

        const minRating = Number(req.query.min_rating);
        if (Number.isFinite(minRating) && minRating > 0) {
            const all = await ratingsFor();
            const ids = Object.entries(all)
                .filter(([, r]) => r.avg >= minRating)
                .map(([id]) => id);
            filter.user_id = filter.user_id
                ? { $in: ids.filter(id => filter.user_id.$in.includes(id)) }
                : { $in: ids };
        }

        if (q) {
            const matchingUsers = await db.collection("users")
                .find({ name: { $regex: escapeRegex(q), $options: "i" } })
                .project({ user_id: 1 })
                .toArray();
            const ids = matchingUsers.map(u => u.user_id);
            filter.user_id = filter.user_id
                ? { $in: ids.filter(id => filter.user_id.$in.includes(id)) }
                : { $in: ids };
        }

        const total = await db.collection("learner_profiles").countDocuments(filter);

        const profiles = await db.collection("learner_profiles")
            .find(filter)
            .project({ _id: 0, user_id: 1, track: 1, skills: 1, skill_levels: 1, location: 1,
                profile_image: 1, profile_completed: 1, cv: 1, bio: 1, experience_level: 1 })
            .sort({ profile_completed: -1, updated_at: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray();

        const ids = profiles.map(p => p.user_id);

        const [users, badges, certificates] = await Promise.all([
            db.collection("users").find({ user_id: { $in: ids } })
                .project({ _id: 0, user_id: 1, name: 1 }).toArray(),
            db.collection("learner_badges").find({ user_id: { $in: ids } })
                .project({ _id: 0, user_id: 1, name: 1, title: 1 }).toArray(),
            db.collection("certificates").find({ user_id: { $in: ids } })
                .project({ _id: 0, user_id: 1 }).toArray()
        ]);

        const names = Object.fromEntries(users.map(u => [u.user_id, u.name]));
        const ratings = await ratingsFor(ids);

        return res.json({
            success: true,
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            total,
            candidates: profiles.map(p => ({
                user_id: p.user_id,
                name: names[p.user_id] || "Learner",
                track: p.track || "",
                skills: p.skills || [],
                skill_levels: p.skill_levels || {},
                experience_level: p.experience_level || "",
                rating: ratings[p.user_id]?.avg || null,
                rating_count: ratings[p.user_id]?.count || 0,
                location: p.location || "",
                bio: p.bio || "",
                profile_image: p.profile_image || null,
                profile_completed: p.profile_completed || 0,
                has_cv: Boolean(p.cv),
                badges: badges.filter(b => b.user_id === p.user_id).map(b => b.name || b.title),
                certificates: certificates.filter(c => c.user_id === p.user_id).length
            }))
        });

    } catch (error) {
        return serverError(res, "Search candidates error", error);
    }
}


module.exports = {
    getProfile,
    saveProfile,
    getDashboard,
    listJobs,
    getJob,
    createJob,
    updateJob,
    submitJob,
    closeJob,
    deleteDraftJob,
    listApplications,
    updateApplicationStatus,
    rateApplicant,
    searchCandidates,
    allowedNextStatuses
};
