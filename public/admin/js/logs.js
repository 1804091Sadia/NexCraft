// Audit logs (FR-43) and Learner -> Trainer conversions (FR-31)
const table = document.getElementById("logsTable");

const ACTION_TEXT = {
    job_approve: "Approved job",
    job_reject: "Rejected job",
    program_approve: "Approved program",
    program_reject: "Rejected program",
    user_suspend: "Suspended user",
    user_reactivate: "Reactivated user",
    showcase_hide: "Hid graduate",
    showcase_show: "Restored graduate",
    badge_award: "Awarded badge",
    trainer_application_approve: "Approved trainer application",
    trainer_application_reject: "Rejected trainer application"
};

async function loadAudit() {
    const { logs } = await apiFetch("/api/admin/audit-logs");

    if (!logs.length) return emptyState("No admin actions yet");

    return `
        <div class="table-wrap"><table class="data-table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason / detail</th></tr></thead>
            <tbody>
            ${logs.map(l => `
                <tr>
                    <td data-label="When">${formatDate(l.created_at, true)}</td>
                    <td data-label="Admin">${escapeHTML(l.actor_name)}</td>
                    <td data-label="Action">${escapeHTML(ACTION_TEXT[l.action] || l.action)}</td>
                    <td data-label="Target"><span class="sub" style="margin:0;">${escapeHTML(l.target_type)}</span>${escapeHTML(l.target_id)}</td>
                    <td data-label="Reason" class="muted">${escapeHTML(l.reason || l.badge_name || "—")}</td>
                </tr>`).join("")}
            </tbody>
        </table></div>`;
}

async function loadRoles() {
    const { logs } = await apiFetch("/api/admin/role-changes");

    if (!logs.length) return emptyState("No conversions yet");

    return `
        <div class="table-wrap"><table class="data-table">
            <thead><tr><th>When</th><th>User</th><th>Change</th><th>Reviewed by</th><th>Note</th></tr></thead>
            <tbody>
            ${logs.map(l => `
                <tr>
                    <td data-label="When">${formatDate(l.changed_at, true)}</td>
                    <td data-label="User">${escapeHTML(l.user_name)}</td>
                    <td data-label="Change">${escapeHTML(l.from_role || "—")} → ${escapeHTML(l.to_role)}
                        ${l.action === "application_rejected" ? statusPill("Rejected") : ""}</td>
                    <td data-label="Reviewed by">${escapeHTML(l.reviewer_name || "—")}</td>
                    <td data-label="Note" class="muted">${escapeHTML(l.reason || "—")}</td>
                </tr>`).join("")}
            </tbody>
        </table></div>`;
}

initPage().then(() => {
    setupTabs(document.getElementById("logTabs"), async tab => {
        table.innerHTML = loadingState();
        try {
            table.innerHTML = tab === "roles" ? await loadRoles() : await loadAudit();
        } catch (error) {
            table.innerHTML = emptyState("Could not load logs", error.message);
        }
    })("audit");
}).catch(() => {});
