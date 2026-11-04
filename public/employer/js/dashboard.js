// Employer dashboard
initPage().then(async user => {
    try {
        const data = await apiFetch("/api/employers/dashboard");

        document.getElementById("welcome").textContent =
            data.company_name ? `Welcome, ${data.company_name}` : `Welcome, ${user.name}`;

        document.getElementById("profileNotice").hidden = data.hasProfile;

        const tiles = [
            ["Active jobs", data.jobs.active, "Visible to learners", "/employer/jobs.html"],
            ["Pending approval", data.jobs.pending_approval, "Waiting for Admin", "/employer/jobs.html"],
            ["Drafts", data.jobs.draft, "Not submitted yet", "/employer/jobs.html"],
            ["Applicants", data.applications.total, `${data.applications.new} new`, "/employer/applications.html"],
            ["Shortlisted", data.applications.shortlisted, "In progress", "/employer/applications.html"],
            ["Placed", data.applications.placed, "Hired", "/employer/applications.html"]
        ];

        if (data.jobs.rejected) {
            tiles.splice(3, 0, ["Rejected", data.jobs.rejected, "Edit and resubmit", "/employer/jobs.html"]);
        }

        document.getElementById("tiles").innerHTML = tiles.map(([label, value, note, href]) => `
            <a class="tile ${label === "Rejected" ? "attention" : ""}" href="${href}">
                <div class="tile-label">${escapeHTML(label)}</div>
                <div class="tile-value">${escapeHTML(value)}</div>
                <div class="tile-note">${escapeHTML(note)}</div>
            </a>`).join("");

        const recent = document.getElementById("recent");

        if (!data.recentApplications.length) {
            recent.innerHTML = data.jobs.active
                ? emptyState("No applicants yet", "Applicants to your active jobs will appear here.")
                : emptyState("No applicants yet", "Post a job and get it approved to start receiving applicants.",
                    `<a class="btn btn-primary" href="/employer/job-form.html">Post a Job</a>`);
            return;
        }

        recent.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>Applicant</th><th>Job</th><th>Applied</th><th>Status</th></tr></thead>
                <tbody>
                ${data.recentApplications.map(a => `
                    <tr>
                        <td data-label="Applicant"><strong>${escapeHTML(a.applicant_name)}</strong>
                            <span class="sub">${escapeHTML(a.reference_no || "")}</span></td>
                        <td data-label="Job">${escapeHTML(a.job_title)}</td>
                        <td data-label="Applied">${formatDate(a.created_at)}</td>
                        <td data-label="Status">${statusPill(a.status)}</td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        flash(error.message);
        document.getElementById("recent").innerHTML = emptyState("Could not load dashboard", error.message);
    }
}).catch(() => {});
