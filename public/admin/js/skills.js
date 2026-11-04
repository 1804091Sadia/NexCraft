// Skills master catalogue (spec 3.7)
const table = document.getElementById("skillsTable");
const form = document.getElementById("skillForm");

async function loadSkills() {
    try {
        const { skills } = await apiFetch("/api/skills");

        document.getElementById("categoryList").innerHTML = [...new Set(skills.map(s => s.category))]
            .map(c => `<option value="${escapeHTML(c)}">`).join("");

        if (!skills.length) {
            table.innerHTML = emptyState("The catalogue is empty", "Add common skills such as JavaScript, MongoDB, Git and Figma.");
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>Skill</th><th>Category</th><th></th></tr></thead>
                <tbody>
                ${skills.map(s => `
                    <tr>
                        <td data-label="Skill"><strong>${escapeHTML(s.name)}</strong></td>
                        <td data-label="Category">${escapeHTML(s.category)}</td>
                        <td><div class="actions">
                            <button class="btn btn-outline btn-sm" data-remove="${escapeHTML(s.skill_id)}" data-name="${escapeHTML(s.name)}">Remove</button>
                        </div></td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        table.innerHTML = emptyState("Could not load skills", error.message);
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("skillName").value.trim();
    const category = document.getElementById("skillCategory").value.trim();

    if (!name) {
        flash("Please enter a skill name.");
        return;
    }

    try {
        await withBusy(form.querySelector("button"), "Adding…", () =>
            apiFetch("/api/admin/skills", { method: "POST", body: { name, category } }));
        flash(`"${name}" added.`, "success");
        form.reset();
        document.getElementById("skillName").focus();
        loadSkills();
    } catch (error) {
        flash(error.message);
    }
});

table.addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;

    openModal({
        title: `Remove "${button.dataset.name}"?`,
        body: "<p>It stops being suggested in forms. Jobs and profiles that already list it keep it.</p>",
        confirmText: "Remove",
        danger: true,
        onConfirm: async () => {
            await apiFetch(`/api/admin/skills/${encodeURIComponent(button.dataset.remove)}`, { method: "DELETE" });
            flash("Skill removed.", "success");
            loadSkills();
        }
    });
});

initPage().then(loadSkills).catch(() => {});
