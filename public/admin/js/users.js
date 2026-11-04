// Manage users (FR-30)
const table = document.getElementById("usersTable");
const pager = document.getElementById("pager");
const startParams = new URLSearchParams(location.search);
let page = 1;
let me = null;

if (startParams.get("role")) document.getElementById("role").value = startParams.get("role");

async function loadUsers() {
    table.innerHTML = loadingState();
    pager.innerHTML = "";

    const params = new URLSearchParams({ page });
    ["q", "role", "status"].forEach(id => {
        const value = document.getElementById(id).value.trim();
        if (value) params.set(id, value);
    });

    try {
        const data = await apiFetch(`/api/admin/users?${params}`);

        if (!data.users.length) {
            table.innerHTML = emptyState("No users found", "Try a different search.");
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>User</th><th>Roles</th><th>Joined</th><th>Status</th><th></th></tr></thead>
                <tbody>
                ${data.users.map(u => `
                    <tr>
                        <td data-label="User">
                            <div class="person">${avatar(u.name, null, 34)}
                                <div><strong>${escapeHTML(u.name)}</strong><span class="sub">${escapeHTML(u.email)}</span></div>
                            </div>
                        </td>
                        <td data-label="Roles">${(u.roles || []).map(r => `<span class="chip">${escapeHTML(r)}</span>`).join("") || '<span class="muted">No role yet</span>'}</td>
                        <td data-label="Joined">${formatDate(u.created_at)}</td>
                        <td data-label="Status">${statusPill(u.status)}
                            ${u.status === "suspended" && u.status_reason ? `<span class="sub">${escapeHTML(u.status_reason)}</span>` : ""}</td>
                        <td><div class="actions">
                            ${u.user_id === me.user_id ? '<span class="muted" style="font-size:13px;">You</span>'
                                : u.status === "active"
                                    ? `<button class="btn btn-danger btn-sm" data-suspend="${escapeHTML(u.user_id)}" data-name="${escapeHTML(u.name)}">Suspend</button>`
                                    : `<button class="btn btn-success btn-sm" data-reactivate="${escapeHTML(u.user_id)}">Reactivate</button>`}
                        </div></td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

        if (data.totalPages > 1) {
            pager.innerHTML = `
                <button class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Previous</button>
                <span class="muted">Page ${data.page} of ${data.totalPages} · ${data.total} users</span>
                <button class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= data.totalPages ? "disabled" : ""}>Next →</button>`;
        }

    } catch (error) {
        table.innerHTML = emptyState("Could not load users", error.message);
    }
}

table.addEventListener("click", event => {
    const suspend = event.target.closest("[data-suspend]");
    if (suspend) {
        askReason({
            title: `Suspend ${suspend.dataset.name}?`,
            label: "Reason (kept in the audit log)",
            confirmText: "Suspend account",
            onConfirm: async reason => {
                const data = await apiFetch(`/api/admin/users/${encodeURIComponent(suspend.dataset.suspend)}/suspend`,
                    { method: "PATCH", body: { reason } });
                flash(data.message, "success");
                loadUsers();
            }
        });
        return;
    }

    const reactivate = event.target.closest("[data-reactivate]");
    if (reactivate) {
        withBusy(reactivate, "Saving…", async () => {
            const data = await apiFetch(`/api/admin/users/${encodeURIComponent(reactivate.dataset.reactivate)}/reactivate`,
                { method: "PATCH" });
            flash(data.message, "success");
            loadUsers();
        }).catch(error => flash(error.message));
    }
});

pager.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    page = Number(button.dataset.page);
    loadUsers();
});

const reload = () => { page = 1; loadUsers(); };
document.getElementById("q").addEventListener("input", debounce(reload, 350));
document.getElementById("role").addEventListener("change", reload);
document.getElementById("status").addEventListener("change", reload);
document.getElementById("filterForm").addEventListener("submit", e => { e.preventDefault(); reload(); });

initPage().then(user => {
    me = user;
    loadUsers();
}).catch(() => {});
