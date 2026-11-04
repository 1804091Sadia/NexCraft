// Browse candidates (FR-25)
function stars(value) {
    const full = Math.round(value);
    return "★".repeat(full) + "☆".repeat(5 - full);
}
const form = document.getElementById("searchForm");
const grid = document.getElementById("candidates");
const pager = document.getElementById("pager");
let page = 1;

async function search() {
    grid.innerHTML = loadingState("Searching…");
    pager.innerHTML = "";

    const params = new URLSearchParams({ page });
    ["q", "track", "skill", "badge", "min_rating"].forEach(id => {
        const value = document.getElementById(id).value.trim();
        if (value) params.set(id, value);
    });

    try {
        const data = await apiFetch(`/api/employers/candidates?${params}`);

        document.getElementById("resultCount").textContent =
            `${data.total} candidate${data.total === 1 ? "" : "s"} found`;

        if (!data.candidates.length) {
            grid.innerHTML = emptyState("No candidates match", "Try removing a filter.");
            return;
        }

        grid.innerHTML = data.candidates.map(c => `
            <article class="person-card">
                <div class="person">
                    ${avatar(c.name, c.profile_image, 48)}
                    <div>
                        <h3>${escapeHTML(c.name)}</h3>
                        <span class="muted" style="font-size:13px;">${escapeHTML(c.track || "Track not set")}${c.location ? " · " + escapeHTML(c.location) : ""}</span>
                    </div>
                </div>
                ${c.bio ? `<p class="muted" style="font-size:13px;">${escapeHTML(c.bio.slice(0, 140))}${c.bio.length > 140 ? "…" : ""}</p>` : ""}
                <div>${c.skills.slice(0, 8).map(s => `<span class="chip">${escapeHTML(s)}${c.skill_levels[s] ? ` · ${escapeHTML(c.skill_levels[s])}` : ""}</span>`).join("") || '<span class="muted" style="font-size:13px;">No skills listed</span>'}</div>
                <div style="font-size:13px;">
                    ${c.rating ? `<strong>${stars(c.rating)}</strong> ${escapeHTML(c.rating)} <span class="muted">(${c.rating_count} employer rating${c.rating_count === 1 ? "" : "s"})</span>`
                        : '<span class="muted">Not rated yet</span>'}
                    ${c.experience_level ? ` · <span class="muted">${escapeHTML(c.experience_level)}</span>` : ""}
                </div>
                <div style="font-size:13px;" class="muted">
                    🏆 ${c.badges.length ? c.badges.map(escapeHTML).join(", ") : "No badges"} ·
                    🎓 ${c.certificates} certificate${c.certificates === 1 ? "" : "s"} ·
                    Profile ${escapeHTML(c.profile_completed)}%
                </div>
                <div class="card-actions">
                    <button type="button" class="btn btn-primary btn-sm"
                        data-message="${escapeHTML(c.user_id)}" data-name="${escapeHTML(c.name)}">Message</button>
                </div>
            </article>`).join("");

        if (data.totalPages > 1) {
            pager.innerHTML = `
                <button class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Previous</button>
                <span class="muted">Page ${data.page} of ${data.totalPages}</span>
                <button class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= data.totalPages ? "disabled" : ""}>Next →</button>`;
        }

    } catch (error) {
        grid.innerHTML = emptyState("Search failed", error.message);
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();
    page = 1;
    search();
});

["badge", "min_rating"].forEach(id =>
    document.getElementById(id).addEventListener("change", () => { page = 1; search(); }));

pager.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    page = Number(button.dataset.page);
    search();
});

grid.addEventListener("click", event => {
    const button = event.target.closest("[data-message]");
    if (button) composeMessage({ toId: button.dataset.message, toName: button.dataset.name });
});

initPage().then(() => {
    apiFetch("/api/skills").then(({ skills }) => {
        document.getElementById("skillList").innerHTML =
            skills.map(s => `<option value="${escapeHTML(s.name)}">`).join("");
    }).catch(() => {});

    apiFetch("/api/badge-catalogue").then(({ badges }) => {
        document.getElementById("badge").innerHTML += badges
            .map(b => `<option value="${escapeHTML(b.name)}">${escapeHTML(b.icon || "")} ${escapeHTML(b.name)}</option>`)
            .join("");
    }).catch(() => {});

    search();
}).catch(() => {});
