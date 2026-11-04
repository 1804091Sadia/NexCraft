// Admin overview (FR-32)
const ACTION_TEXT = {
    job_approve: "approved a job",
    job_reject: "rejected a job",
    program_approve: "approved a program",
    program_reject: "rejected a program",
    user_suspend: "suspended a user",
    user_reactivate: "reactivated a user",
    showcase_hide: "hid a graduate",
    showcase_show: "restored a graduate",
    badge_award: "awarded a badge",
    trainer_application_approve: "approved a trainer",
    trainer_application_reject: "rejected a trainer application"
};

function tile(label, value, note, href, attention = false) {
    const tag = href === "#" ? "div" : "a";
    return `
        <${tag} class="tile ${attention ? "attention" : ""}" ${tag === "a" ? `href="${href}"` : ""}>
            <div class="tile-label">${escapeHTML(label)}</div>
            <div class="tile-value">${escapeHTML(value)}</div>
            ${note ? `<div class="tile-note">${escapeHTML(note)}</div>` : ""}
        </${tag}>`;
}

initPage().then(async () => {
    try {
        const d = await apiFetch("/api/admin/overview");

        const waiting = d.jobs.pending + d.programs.pending + d.pendingTrainerApplications;

        document.getElementById("attention").innerHTML = waiting
            ? [
                d.jobs.pending ? tile("Jobs to review", d.jobs.pending, "Pending approval", "/admin/approvals.html?tab=jobs", true) : "",
                d.programs.pending ? tile("Programs to review", d.programs.pending, "Pending approval", "/admin/approvals.html?tab=programs", true) : "",
                d.pendingTrainerApplications ? tile("Trainer applications", d.pendingTrainerApplications, "Learners asking to teach", "/admin/approvals.html?tab=trainers", true) : ""
            ].join("")
            : `<div class="notice info" style="grid-column:1/-1;margin:0;">Nothing is waiting for review.</div>`;

        document.getElementById("tiles").innerHTML = [
            tile("Users", d.users.total, `${d.users.suspended} suspended`, "/admin/users.html"),
            tile("Learners", d.users.learners, "", "/admin/users.html?role=Learner"),
            tile("Trainers", d.users.trainers, "", "/admin/users.html?role=Trainer"),
            tile("Employers", d.users.employers, "", "/admin/users.html?role=Employer"),
            tile("Active jobs", d.jobs.active, "", "/admin/approvals.html?tab=jobs&show=all"),
            tile("Active programs", d.programs.active, "", "/admin/approvals.html?tab=programs&show=all"),
            tile("Applications", d.applications, "", "#"),
            tile("Enrollments", d.enrollments, "", "#"),
            tile("Graduates", d.certificates, "Certificates issued", "/admin/showcase.html")
        ].join("");

        const recent = document.getElementById("recent");

        if (!d.recentActions.length) {
            recent.innerHTML = emptyState("No admin actions yet", "Approvals, suspensions and badge awards appear here.");
            return;
        }

        recent.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Reason</th></tr></thead>
                <tbody>
                ${d.recentActions.map(a => `
                    <tr>
                        <td data-label="When">${formatDate(a.created_at, true)}</td>
                        <td data-label="Who">${escapeHTML(a.actor_name)}</td>
                        <td data-label="Action">${escapeHTML(ACTION_TEXT[a.action] || a.action)}</td>
                        <td data-label="Reason" class="muted">${escapeHTML(a.reason || "—")}</td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        flash(error.message);
    }
}).catch(() => {});
