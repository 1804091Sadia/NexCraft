// Employer job list (FR-24)
const table = document.getElementById("jobsTable");
let currentStatus = new URLSearchParams(location.search).get("status") || "";

async function loadJobs() {
    table.innerHTML = loadingState();

    try {
        const query = currentStatus ? `?status=${encodeURIComponent(currentStatus)}` : "";
        const { jobs } = await apiFetch(`/api/employers/jobs${query}`);

        if (!jobs.length) {
            table.innerHTML = emptyState(
                currentStatus ? `No ${statusLabel(currentStatus).toLowerCase()} jobs` : "No jobs yet",
                currentStatus ? "" : "Create your first job post. It goes live after an Admin approves it.",
                currentStatus ? "" : `<a class="btn btn-primary" href="/employer/job-form.html">Post a Job</a>`
            );
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr>
                    <th>Job</th><th>Status</th><th>Applicants</th><th>Updated</th><th class="sr-only">Actions</th>
                </tr></thead>
                <tbody>${jobs.map(rowHtml).join("")}</tbody>
            </table></div>`;

    } catch (error) {
        table.innerHTML = emptyState("Could not load jobs", error.message);
    }
}

function rowHtml(job) {
    const id = escapeHTML(job.job_id);
    const editable = ["draft", "rejected"].includes(job.status);
    const actions = [];

    if (editable) {
        actions.push(`<a class="btn btn-outline btn-sm" href="/employer/job-form.html?id=${encodeURIComponent(job.job_id)}">Edit</a>`);
        actions.push(`<button class="btn btn-primary btn-sm" data-action="submit" data-id="${id}">Submit</button>`);
    }
    if (job.status === "draft") {
        actions.push(`<button class="btn btn-outline btn-sm" data-action="delete" data-id="${id}">Delete</button>`);
    }
    if (job.status === "active") {
        actions.push(`<a class="btn btn-outline btn-sm" href="/employer/applications.html?job=${encodeURIComponent(job.job_id)}">Applicants</a>`);
        actions.push(`<button class="btn btn-danger btn-sm" data-action="close" data-id="${id}" data-title="${escapeHTML(job.title)}">Close</button>`);
    }
    if (job.status === "closed" && job.application_count) {
        actions.push(`<a class="btn btn-outline btn-sm" href="/employer/applications.html?job=${encodeURIComponent(job.job_id)}">Applicants</a>`);
    }

    return `
        <tr>
            <td data-label="Job">
                <strong>${escapeHTML(job.title)}</strong>
                <span class="sub">${escapeHTML(job.job_type)} · ${escapeHTML(job.location)} · ${escapeHTML(formatSalary(job.salary_min, job.salary_max))}</span>
                ${job.status === "rejected" && job.rejection_reason
                    ? `<span class="sub" style="color:var(--danger);">Rejected: ${escapeHTML(job.rejection_reason)}</span>` : ""}
            </td>
            <td data-label="Status">${statusPill(job.status)}</td>
            <td data-label="Applicants">${escapeHTML(job.application_count)}</td>
            <td data-label="Updated">${formatDate(job.updated_at)}</td>
            <td><div class="actions">${actions.join("")}</div></td>
        </tr>`;
}

table.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "submit") {
        withBusy(button, "Submitting…", async () => {
            const data = await apiFetch(`/api/employers/jobs/${encodeURIComponent(id)}/submit`, { method: "PATCH" });
            flash(data.message, "success");
            loadJobs();
        }).catch(error => flash(error.message));
    }

    if (action === "delete") {
        openModal({
            title: "Delete this draft?",
            body: "<p>The draft is removed permanently.</p>",
            confirmText: "Delete draft",
            danger: true,
            onConfirm: async () => {
                const data = await apiFetch(`/api/employers/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
                flash(data.message, "success");
                loadJobs();
            }
        });
    }

    if (action === "close") {
        openModal({
            title: "Close this job?",
            body: `<p>"${escapeHTML(button.dataset.title)}" will stop accepting applications.
                   Existing applicants stay in your list.</p>`,
            confirmText: "Close job",
            danger: true,
            onConfirm: async () => {
                const data = await apiFetch(`/api/employers/jobs/${encodeURIComponent(id)}/close`, { method: "PATCH" });
                flash(data.message, "success");
                loadJobs();
            }
        });
    }
});

initPage().then(() => {
    const select = setupTabs(document.getElementById("statusTabs"), status => {
        currentStatus = status;
        const url = new URL(location.href);
        status ? url.searchParams.set("status", status) : url.searchParams.delete("status");
        history.replaceState(null, "", url);
        loadJobs();
    });
    select(currentStatus);
}).catch(() => {});
