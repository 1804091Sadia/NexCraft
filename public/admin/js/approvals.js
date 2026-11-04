// Approvals: jobs (FR-28), programs (FR-29), trainer applications (FR-06)
const list = document.getElementById("list");
const statusFilter = document.getElementById("statusFilter");
const params = new URLSearchParams(location.search);

let currentTab = params.get("tab") || "jobs";
if (params.get("show") === "all") statusFilter.value = "all";

const ENDPOINTS = {
    jobs: {
        list: s => `/api/admin/jobs?status=${s === "all" ? "all" : "pending_approval"}`,
        approve: id => `/api/admin/jobs/${encodeURIComponent(id)}/approve`,
        reject: id => `/api/admin/jobs/${encodeURIComponent(id)}/reject`,
        id: item => item.job_id,
        noun: "job post"
    },
    programs: {
        list: s => `/api/admin/programs?status=${s === "all" ? "all" : "pending_approval"}`,
        approve: id => `/api/admin/programs/${encodeURIComponent(id)}/approve`,
        reject: id => `/api/admin/programs/${encodeURIComponent(id)}/reject`,
        id: item => item.program_id,
        noun: "program"
    },
    trainers: {
        list: s => `/api/admin/trainer-applications?status=${s === "all" ? "all" : "pending"}`,
        approve: id => `/api/trainer-conversion/admin/${encodeURIComponent(id)}/approve`,
        reject: id => `/api/trainer-conversion/admin/${encodeURIComponent(id)}/reject`,
        id: item => item.application_id,
        noun: "trainer application"
    }
};

let items = [];

function isPending(item) {
    return ["pending_approval", "pending"].includes(item.status);
}

function summary(item) {
    if (currentTab === "jobs") {
        return `<strong>${escapeHTML(item.title)}</strong>
            <span class="sub">${escapeHTML(item.company || item.owner_name)} · ${escapeHTML(item.job_type)} · ${escapeHTML(item.location)}</span>`;
    }
    if (currentTab === "programs") {
        return `<strong>${escapeHTML(item.title)}</strong>
            <span class="sub">by ${escapeHTML(item.owner_name)} · ${escapeHTML(item.mode)} · ${escapeHTML(item.duration)}${item.level ? " · " + escapeHTML(item.level) : ""}</span>`;
    }
    return `<strong>${escapeHTML(item.applicant_name)}</strong>
        <span class="sub">${escapeHTML(item.applicant_email)} · ${escapeHTML(item.expertise_area)}</span>`;
}

function details(item) {
    if (currentTab === "jobs") {
        return `
            <dl class="detail-grid">
                <dt>Company</dt><dd>${escapeHTML(item.company || item.owner_name)}</dd>
                <dt>Category</dt><dd>${escapeHTML(item.category)}</dd>
                <dt>Type</dt><dd>${escapeHTML(item.job_type)}</dd>
                <dt>Location</dt><dd>${escapeHTML(item.location)}</dd>
                <dt>Salary</dt><dd>${escapeHTML(formatSalary(item.salary_min, item.salary_max))}</dd>
                <dt>Skills</dt><dd>${(item.skill_tags || []).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join("") || "—"}</dd>
            </dl>
            <h3 style="font-size:15px;">Description</h3>
            <p class="prewrap muted">${escapeHTML(item.description)}</p>
            ${item.responsibilities ? `<h3 style="font-size:15px;margin-top:12px;">Responsibilities</h3><p class="prewrap muted">${escapeHTML(item.responsibilities)}</p>` : ""}
            ${item.requirements ? `<h3 style="font-size:15px;margin-top:12px;">Requirements</h3><p class="prewrap muted">${escapeHTML(item.requirements)}</p>` : ""}`;
    }
    if (currentTab === "programs") {
        return `
            <dl class="detail-grid">
                <dt>Trainer</dt><dd>${escapeHTML(item.owner_name)}</dd>
                <dt>Category</dt><dd>${escapeHTML(item.category)}</dd>
                <dt>Mode</dt><dd>${escapeHTML(item.mode)}</dd>
                <dt>Duration</dt><dd>${escapeHTML(item.duration)}</dd>
                <dt>Level</dt><dd>${escapeHTML(item.level || "—")}</dd>
                <dt>Skills</dt><dd>${(item.skill_tags || []).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join("") || "—"}</dd>
            </dl>
            <h3 style="font-size:15px;">Description</h3>
            <p class="prewrap muted">${escapeHTML(item.description)}</p>
            ${item.prerequisites ? `<h3 style="font-size:15px;margin-top:12px;">Prerequisites</h3><p class="prewrap muted">${escapeHTML(item.prerequisites)}</p>` : ""}`;
    }
    return `
        <dl class="detail-grid">
            <dt>Applicant</dt><dd>${escapeHTML(item.applicant_name)} (${escapeHTML(item.applicant_email)})</dd>
            <dt>Expertise</dt><dd>${escapeHTML(item.expertise_area)}</dd>
            <dt>Experience</dt><dd>${escapeHTML(item.experience || "—")}</dd>
            <dt>Submitted</dt><dd>${formatDate(item.submitted_at, true)}</dd>
        </dl>
        <h3 style="font-size:15px;">Bio</h3>
        <p class="prewrap muted">${escapeHTML(item.bio || "No bio given.")}</p>`;
}

async function loadCounts() {
    const [jobs, programs, trainers] = await Promise.all([
        apiFetch(ENDPOINTS.jobs.list("pending")),
        apiFetch(ENDPOINTS.programs.list("pending")),
        apiFetch(ENDPOINTS.trainers.list("pending"))
    ]);
    [["countJobs", jobs.items.length], ["countPrograms", programs.items.length], ["countTrainers", trainers.items.length]]
        .forEach(([id, count]) => {
            const el = document.getElementById(id);
            el.textContent = count;
            el.hidden = count === 0;
        });
}

async function loadList() {
    list.innerHTML = loadingState();
    const config = ENDPOINTS[currentTab];

    try {
        items = (await apiFetch(config.list(statusFilter.value))).items;

        if (!items.length) {
            list.innerHTML = emptyState(
                statusFilter.value === "pending" ? "All caught up" : "Nothing here yet",
                statusFilter.value === "pending" ? `No ${config.noun}s are waiting for review.` : ""
            );
            return;
        }

        list.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>${currentTab === "trainers" ? "Applicant" : "Title"}</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
                <tbody>
                ${items.map(item => {
                    const id = escapeHTML(config.id(item));
                    return `
                    <tr>
                        <td data-label="Item">${summary(item)}
                            ${item.rejection_reason ? `<span class="sub" style="color:var(--danger);">Reason: ${escapeHTML(item.rejection_reason)}</span>` : ""}</td>
                        <td data-label="Submitted">${formatDate(item.submitted_at || item.updated_at || item.created_at)}</td>
                        <td data-label="Status">${statusPill(item.status)}</td>
                        <td><div class="actions">
                            <button class="btn btn-outline btn-sm" data-view="${id}">Details</button>
                            ${isPending(item) ? `
                                <button class="btn btn-success btn-sm" data-approve="${id}">Approve</button>
                                <button class="btn btn-danger btn-sm" data-reject="${id}">Reject</button>` : ""}
                        </div></td>
                    </tr>`;
                }).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        list.innerHTML = emptyState("Could not load", error.message);
    }
}

async function approve(id) {
    const data = await apiFetch(ENDPOINTS[currentTab].approve(id), { method: "PATCH" });
    flash(data.message, "success");
    loadList();
    loadCounts().catch(() => {});
}

function reject(id) {
    const config = ENDPOINTS[currentTab];
    askReason({
        title: `Reject ${config.noun}`,
        label: "Reason for rejection (required)",
        confirmText: "Reject",
        onConfirm: async reason => {
            // Trainer applications use "rejection_reason"; the rest use "reason"
            const body = currentTab === "trainers" ? { rejection_reason: reason } : { reason };
            const data = await apiFetch(config.reject(id), { method: "PATCH", body });
            flash(data.message, "success");
            loadList();
            loadCounts().catch(() => {});
        }
    });
}

list.addEventListener("click", event => {
    const config = ENDPOINTS[currentTab];

    const view = event.target.closest("[data-view]");
    if (view) {
        const item = items.find(i => config.id(i) === view.dataset.view);
        openModal({
            title: currentTab === "trainers" ? "Trainer application" : item.title,
            wide: true,
            body: details(item) + (isPending(item) ? `
                <div class="form-actions" style="margin-top:18px;">
                    <button class="btn btn-danger" id="modalReject">Reject…</button>
                    <button class="btn btn-success" id="modalApprove">Approve</button>
                </div>` : "")
        });
        if (isPending(item)) {
            document.getElementById("modalApprove").addEventListener("click", event2 => {
                withBusy(event2.currentTarget, "Approving…", () => approve(view.dataset.view))
                    .then(closeModal).catch(error => flash(error.message));
            });
            document.getElementById("modalReject").addEventListener("click", () => reject(view.dataset.view));
        }
        return;
    }

    const approveButton = event.target.closest("[data-approve]");
    if (approveButton) {
        withBusy(approveButton, "Approving…", () => approve(approveButton.dataset.approve))
            .catch(error => flash(error.message));
        return;
    }

    const rejectButton = event.target.closest("[data-reject]");
    if (rejectButton) reject(rejectButton.dataset.reject);
});

statusFilter.addEventListener("change", loadList);

initPage().then(() => {
    const select = setupTabs(document.getElementById("kindTabs"), tab => {
        currentTab = tab;
        const url = new URL(location.href);
        url.searchParams.set("tab", tab);
        history.replaceState(null, "", url);
        loadList();
    });
    select(currentTab);
    loadCounts().catch(() => {});
}).catch(() => {});
