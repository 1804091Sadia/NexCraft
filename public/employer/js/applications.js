// Employer applicants (FR-40, FR-41, FR-26)
const table = document.getElementById("applicationsTable");
const jobFilter = document.getElementById("jobFilter");
const statusFilter = document.getElementById("statusFilter");

const FLOW = ["Received", "Under Review", "Shortlisted", "Interview Scheduled", "Outcome Pending", "Placed"];
const TERMINAL = ["Placed", "Not Progressed", "Withdrawn"];
let applications = [];

function nextStatuses(current) {
    if (TERMINAL.includes(current)) return [];
    return [...FLOW.slice(FLOW.indexOf(current) + 1), "Not Progressed"];
}

async function loadApplications() {
    table.innerHTML = loadingState();

    const params = new URLSearchParams();
    if (jobFilter.value) params.set("job_id", jobFilter.value);
    if (statusFilter.value) params.set("status", statusFilter.value);

    const url = new URL(location.href);
    jobFilter.value ? url.searchParams.set("job", jobFilter.value) : url.searchParams.delete("job");
    history.replaceState(null, "", url);

    try {
        const data = await apiFetch(`/api/employers/applications?${params}`);
        applications = data.applications;

        if (!applications.length) {
            table.innerHTML = emptyState("No applicants here",
                statusFilter.value || jobFilter.value
                    ? "Try another job or status."
                    : "Applicants to your active jobs will appear here.");
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>Applicant</th><th>Job</th><th>Applied</th><th>Status</th><th></th></tr></thead>
                <tbody>
                ${applications.map(a => {
                    const next = nextStatuses(a.status)[0];
                    return `
                    <tr>
                        <td data-label="Applicant">
                            <div class="person">
                                ${avatar(a.applicant_name, a.profile_image, 36)}
                                <div><strong>${escapeHTML(a.applicant_name)}</strong>
                                <span class="sub">${escapeHTML(a.track || a.applicant_email)}</span></div>
                            </div>
                        </td>
                        <td data-label="Job">${escapeHTML(a.job_title)}
                            <span class="sub">${escapeHTML(a.reference_no)}</span></td>
                        <td data-label="Applied">${formatDate(a.created_at)}</td>
                        <td data-label="Status">${statusPill(a.status)}</td>
                        <td><div class="actions">
                            <button class="btn btn-outline btn-sm" data-view="${escapeHTML(a.application_id)}">Review</button>
                            ${next && next !== "Not Progressed"
                                ? `<button class="btn btn-primary btn-sm" data-move="${escapeHTML(a.application_id)}" data-to="${escapeHTML(next)}">→ ${escapeHTML(next)}</button>`
                                : ""}
                        </div></td>
                    </tr>`;
                }).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        table.innerHTML = emptyState("Could not load applicants", error.message);
    }
}

async function changeStatus(applicationId, status, note = "") {
    const data = await apiFetch(
        `/api/employers/applications/${encodeURIComponent(applicationId)}/status`,
        { method: "PATCH", body: { status, note } }
    );
    flash(`${data.message}. The applicant has been notified.`, "success");
    loadApplications();
}

function openReview(application) {
    const a = application;
    const next = nextStatuses(a.status);

    openModal({
        title: a.applicant_name,
        wide: true,
        confirmText: "Update status",
        body: `
            <div class="person" style="margin-bottom:14px;">
                ${avatar(a.applicant_name, a.profile_image, 48)}
                <div>
                    <strong>${escapeHTML(a.applicant_name)}</strong>
                    <span class="sub muted">${escapeHTML(a.applicant_email)}</span>
                </div>
                <div style="margin-left:auto;">${statusPill(a.status)}</div>
            </div>

            <dl class="detail-grid">
                <dt>Job</dt><dd>${escapeHTML(a.job_title)}</dd>
                <dt>Reference</dt><dd>${escapeHTML(a.reference_no)}</dd>
                <dt>Applied</dt><dd>${formatDate(a.created_at, true)}</dd>
                <dt>Track</dt><dd>${escapeHTML(a.track || "—")}</dd>
                <dt>Location</dt><dd>${escapeHTML(a.location || "—")}</dd>
                <dt>Education</dt><dd>${escapeHTML(a.education || "—")}</dd>
                <dt>Employment</dt><dd>${escapeHTML(a.employment_status || "—")}</dd>
                <dt>Experience</dt><dd>${escapeHTML(a.experience_level || "—")}</dd>
                <dt>Skills</dt><dd>${a.skills.length ? a.skills.map(s => `<span class="chip">${escapeHTML(s)}${a.skill_levels[s] ? ` · ${escapeHTML(a.skill_levels[s])}` : ""}</span>`).join("") : "—"}</dd>
            </dl>

            <h3 style="font-size:15px;margin-bottom:6px;">Cover message</h3>
            <p class="prewrap muted" style="margin-bottom:16px;">${escapeHTML(a.cover_letter || "No cover message.")}</p>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
                ${a.has_cv ? `<button type="button" class="btn btn-outline btn-sm" data-cv="${escapeHTML(a.user_id)}">Open CV (PDF)</button>` : `<span class="muted">No CV uploaded</span>`}
                <button type="button" class="btn btn-outline btn-sm" id="messageApplicant">Message applicant</button>
            </div>

            ${["Received", "Withdrawn"].includes(a.status) ? "" : `
            <h3 style="font-size:15px;margin-bottom:6px;">Your rating of this candidate</h3>
            <div class="rating" role="radiogroup" aria-label="Rate from 1 to 5" style="margin-bottom:18px;">
                ${[1, 2, 3, 4, 5].map(n => `
                    <button type="button" class="star ${a.employer_rating >= n ? "on" : ""}" data-rate="${n}"
                        role="radio" aria-checked="${a.employer_rating === n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}
                <span class="muted" id="ratingText" style="margin-left:8px;font-size:13px;">
                    ${a.employer_rating ? `${a.employer_rating} / 5` : "Not rated"}
                </span>
            </div>`}

            <h3 style="font-size:15px;margin-bottom:10px;">History</h3>
            <ul class="timeline" style="margin-bottom:18px;">
                ${(a.status_history.length ? a.status_history : [{ status: a.status, changed_at: a.created_at }])
                    .map(h => `<li><strong>${escapeHTML(h.status)}</strong> · ${formatDate(h.changed_at, true)}
                        ${h.note ? `<br><span class="muted">${escapeHTML(h.note)}</span>` : ""}</li>`).join("")}
            </ul>

            ${next.length ? `
            <div class="form-grid">
                <div class="form-group">
                    <label for="newStatus">Move to</label>
                    <select id="newStatus" class="form-control">
                        ${next.map(s => `<option>${escapeHTML(s)}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label for="statusNote">Note to applicant (optional)</label>
                    <input id="statusNote" class="form-control" maxlength="500" placeholder="e.g. Interview on Monday 10am">
                </div>
            </div>` : `<p class="muted">This application is ${escapeHTML(a.status)} and cannot change.</p>`}`,
        onConfirm: next.length ? async dialog => {
            await changeStatus(a.application_id,
                dialog.querySelector("#newStatus").value,
                dialog.querySelector("#statusNote").value.trim());
        } : null
    });

    document.querySelectorAll("[data-rate]").forEach(button => {
        button.addEventListener("click", async () => {
            const rating = Number(button.dataset.rate);
            try {
                await apiFetch(`/api/employers/applications/${encodeURIComponent(a.application_id)}/rating`,
                    { method: "PATCH", body: { rating } });
                a.employer_rating = rating;
                document.querySelectorAll("[data-rate]").forEach(star => {
                    const n = Number(star.dataset.rate);
                    star.classList.toggle("on", n <= rating);
                    star.setAttribute("aria-checked", String(n === rating));
                });
                document.getElementById("ratingText").textContent = `${rating} / 5 — saved`;
            } catch (error) {
                document.getElementById("ratingText").textContent = error.message;
            }
        });
    });

    document.getElementById("messageApplicant").addEventListener("click", () => {
        composeMessage({
            toId: a.user_id,
            toName: a.applicant_name,
            contextType: "application",
            contextId: a.application_id,
            contextLabel: `${a.job_title} (${a.reference_no})`
        });
    });
}

table.addEventListener("click", event => {
    const view = event.target.closest("[data-view]");
    if (view) {
        openReview(applications.find(a => a.application_id === view.dataset.view));
        return;
    }

    const move = event.target.closest("[data-move]");
    if (move) {
        withBusy(move, "Saving…", () => changeStatus(move.dataset.move, move.dataset.to))
            .catch(error => flash(error.message));
    }
});

jobFilter.addEventListener("change", loadApplications);
statusFilter.addEventListener("change", loadApplications);

initPage().then(async () => {
    const { jobs } = await apiFetch("/api/employers/jobs");
    jobFilter.innerHTML += jobs
        .filter(j => ["active", "closed"].includes(j.status))
        .map(j => `<option value="${escapeHTML(j.job_id)}">${escapeHTML(j.title)} (${escapeHTML(statusLabel(j.status))})</option>`)
        .join("");

    const preselected = new URLSearchParams(location.search).get("job");
    if (preselected) jobFilter.value = preselected;

    loadApplications();
}).catch(error => {
    if (error.message !== "Redirecting") flash(error.message);
});
