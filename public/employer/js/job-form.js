// Create / edit a job post (FR-23)
const form = document.getElementById("jobForm");
const jobId = new URLSearchParams(location.search).get("id");
const FIELDS = ["title", "category", "job_type", "location", "salary_min", "salary_max",
    "skill_tags", "description", "responsibilities", "requirements"];

function readForm() {
    const body = Object.fromEntries(FIELDS.map(f => [f, document.getElementById(f).value.trim()]));
    return body;
}

function validate(body) {
    if (!body.title) return "Job title is required.";
    if (!body.category) return "Category is required.";
    if (!body.job_type) return "Choose an employment type.";
    if (!body.location) return "Location is required.";
    if (body.salary_min && body.salary_max && Number(body.salary_min) > Number(body.salary_max)) {
        return "Minimum salary cannot be higher than maximum salary.";
    }
    if (body.description.length < 30) return "Description must be at least 30 characters.";
    return null;
}

async function save(submit) {
    const body = readForm();
    const problem = validate(body);

    if (problem) {
        flash(problem);
        return;
    }

    if (jobId) {
        await apiFetch(`/api/employers/jobs/${encodeURIComponent(jobId)}`, { method: "PUT", body });
        if (submit) {
            await apiFetch(`/api/employers/jobs/${encodeURIComponent(jobId)}/submit`, { method: "PATCH" });
        }
    } else {
        await apiFetch("/api/employers/jobs", { method: "POST", body: { ...body, submit } });
    }

    window.location.href = `/employer/jobs.html?status=${submit ? "pending_approval" : "draft"}`;
}

form.addEventListener("submit", event => {
    event.preventDefault();
    withBusy(document.getElementById("submitJob"), "Submitting…", () => save(true))
        .catch(error => flash(error.message));
});

document.getElementById("saveDraft").addEventListener("click", event => {
    withBusy(event.currentTarget, "Saving…", () => save(false))
        .catch(error => flash(error.message));
});

initPage().then(async () => {
    // Skill suggestions from the Admin-managed catalogue
    apiFetch("/api/skills").then(({ skills }) => {
        document.getElementById("skillList").innerHTML =
            skills.map(s => `<option value="${escapeHTML(s.name)}">`).join("");
    }).catch(() => {});

    // Company profile is required before posting
    const { profile } = await apiFetch("/api/employers/profile");
    if (!profile) {
        flash("Please complete your company profile first. Redirecting…");
        setTimeout(() => { window.location.href = "/employer/profile.html"; }, 1500);
        return;
    }

    if (!jobId) return;

    document.getElementById("formTitle").textContent = "Edit Job";
    document.title = "Edit Job | NexCraft";

    const { job } = await apiFetch(`/api/employers/jobs/${encodeURIComponent(jobId)}`);

    FIELDS.forEach(f => {
        const value = job[f];
        document.getElementById(f).value = Array.isArray(value)
            ? value.join(", ")
            : value ?? "";
    });

    if (!["draft", "rejected"].includes(job.status)) {
        flash(`This job is ${statusLabel(job.status)} and can no longer be edited.`);
        form.querySelectorAll("input, select, textarea, button").forEach(el => { el.disabled = true; });
    }

    if (job.status === "rejected" && job.rejection_reason) {
        const notice = document.getElementById("rejectionNotice");
        notice.textContent = `Admin feedback: ${job.rejection_reason} — fix this and submit again.`;
        notice.hidden = false;
    }
}).catch(error => {
    if (error.message !== "Redirecting") flash(error.message);
});
