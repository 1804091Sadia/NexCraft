// Badge catalogue + award (FR-42)
const table = document.getElementById("badgesTable");
let badges = [];

async function loadBadges() {
    table.innerHTML = loadingState();

    try {
        badges = (await apiFetch("/api/admin/badges")).badges;

        if (!badges.length) {
            table.innerHTML = emptyState("No badges yet", "Create a badge such as \"Top Performer\" or \"Project Complete\".");
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>Badge</th><th>Awarded</th><th>Created</th><th></th></tr></thead>
                <tbody>
                ${badges.map(b => `
                    <tr>
                        <td data-label="Badge">
                            <div class="person"><span style="font-size:26px;" aria-hidden="true">${escapeHTML(b.icon)}</span>
                                <div><strong>${escapeHTML(b.name)}</strong><span class="sub">${escapeHTML(b.description || "")}</span></div>
                            </div>
                        </td>
                        <td data-label="Awarded">${escapeHTML(b.awarded_count)} learner${b.awarded_count === 1 ? "" : "s"}</td>
                        <td data-label="Created">${formatDate(b.created_at)}</td>
                        <td><div class="actions">
                            <button class="btn btn-primary btn-sm" data-award="${escapeHTML(b.badge_id)}">Award…</button>
                        </div></td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        table.innerHTML = emptyState("Could not load badges", error.message);
    }
}

document.getElementById("newBadge").addEventListener("click", () => {
    openModal({
        title: "New badge",
        confirmText: "Create badge",
        body: `
            <div class="form-group">
                <label for="badgeName" class="required">Name</label>
                <input id="badgeName" class="form-control" maxlength="60" placeholder="e.g. Top Performer">
            </div>
            <div class="form-group">
                <label for="badgeIcon">Icon (one emoji)</label>
                <input id="badgeIcon" class="form-control" maxlength="8" value="🏅">
            </div>
            <div class="form-group">
                <label for="badgeDescription">What it recognises</label>
                <textarea id="badgeDescription" class="form-control" rows="3" maxlength="300"></textarea>
            </div>`,
        onConfirm: async dialog => {
            const name = dialog.querySelector("#badgeName").value.trim();
            if (!name) throw new Error("Please enter a badge name.");
            const data = await apiFetch("/api/admin/badges", {
                method: "POST",
                body: {
                    name,
                    icon: dialog.querySelector("#badgeIcon").value.trim(),
                    description: dialog.querySelector("#badgeDescription").value.trim()
                }
            });
            flash(data.message, "success");
            loadBadges();
        }
    });
});

table.addEventListener("click", event => {
    const button = event.target.closest("[data-award]");
    if (!button) return;

    const badge = badges.find(b => b.badge_id === button.dataset.award);
    let selectedUser = null;

    const dialog = openModal({
        title: `Award "${badge.name}"`,
        confirmText: "Award badge",
        body: `
            <div class="form-group">
                <label for="learnerSearch">Find a learner</label>
                <input id="learnerSearch" class="form-control" placeholder="Type a name or email" autocomplete="off">
            </div>
            <div id="learnerResults" class="muted" style="font-size:14px;">Start typing to search learners.</div>`,
        onConfirm: async () => {
            if (!selectedUser) throw new Error("Choose a learner from the list.");
            const data = await apiFetch(`/api/admin/badges/${encodeURIComponent(badge.badge_id)}/award`, {
                method: "POST",
                body: { user_id: selectedUser }
            });
            flash(data.message, "success");
            loadBadges();
        }
    });

    const input = dialog.querySelector("#learnerSearch");
    const results = dialog.querySelector("#learnerResults");

    input.addEventListener("input", debounce(async () => {
        const q = input.value.trim();
        selectedUser = null;
        if (q.length < 2) {
            results.textContent = "Type at least 2 characters.";
            return;
        }
        try {
            const { users } = await apiFetch(`/api/admin/users?role=Learner&status=active&q=${encodeURIComponent(q)}`);
            results.innerHTML = users.length
                ? users.slice(0, 8).map(u => `
                    <label class="person" style="padding:8px 0;cursor:pointer;">
                        <input type="radio" name="learner" value="${escapeHTML(u.user_id)}">
                        ${avatar(u.name, null, 30)}
                        <span><strong>${escapeHTML(u.name)}</strong><span class="sub">${escapeHTML(u.email)}</span></span>
                    </label>`).join("")
                : "No learners match.";
        } catch (error) {
            results.textContent = error.message;
        }
    }, 300));

    results.addEventListener("change", e => {
        if (e.target.name === "learner") selectedUser = e.target.value;
    });
});

initPage().then(loadBadges).catch(() => {});
