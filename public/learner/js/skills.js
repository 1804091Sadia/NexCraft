// Learner skills with proficiency levels (FR-17, TC-SKILL-01)
// Skills come from the Admin-managed catalogue as suggestions,
// but learners may type any skill.

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const container = document.getElementById("skillsContainer");
let skills = [];      // [{ name, level }]
let dirty = false;

function showMessage(message, type = "error") {
    const box = document.getElementById("message");
    box.textContent = message;
    box.className = `alert alert-${type}`;
    box.style.display = "block";
}

function render() {
    container.innerHTML = `
        <form id="addSkillForm" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;align-items:end;margin-bottom:22px;">
            <div class="form-group" style="margin:0;">
                <label for="newSkill">Skill</label>
                <input id="newSkill" class="form-control" list="skillCatalogue" maxlength="40" placeholder="e.g. JavaScript" autocomplete="off">
                <datalist id="skillCatalogue"></datalist>
            </div>
            <div class="form-group" style="margin:0;">
                <label for="newLevel">Proficiency</label>
                <select id="newLevel" class="form-control">
                    ${LEVELS.map(l => `<option>${l}</option>`).join("")}
                </select>
            </div>
            <button type="submit" class="btn btn-outline">＋ Add skill</button>
        </form>

        ${skills.length ? `
        <div style="display:grid;gap:10px;">
            ${skills.map((skill, index) => `
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;">
                    <strong style="flex:1 1 140px;">${escapeHTML(skill.name)}</strong>
                    <label class="sr-only" for="level-${index}">Proficiency for ${escapeHTML(skill.name)}</label>
                    <select id="level-${index}" class="form-control" data-level="${index}" style="max-width:180px;">
                        ${LEVELS.map(l => `<option ${l === skill.level ? "selected" : ""}>${l}</option>`).join("")}
                    </select>
                    <button type="button" class="btn btn-outline" data-remove="${index}" aria-label="Remove ${escapeHTML(skill.name)}">Remove</button>
                </div>`).join("")}
        </div>` : `
        <div style="text-align:center;padding:24px;color:#64748b;">
            <h3 style="color:#172033;">No skills added yet</h3>
            <p style="margin-top:8px;">Add skills so employers can find you in candidate search.</p>
        </div>`}

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">
            <button type="button" id="saveSkills" class="btn btn-primary" ${dirty ? "" : "disabled"}>
                ${dirty ? "Save changes" : "All changes saved"}
            </button>
        </div>`;

    loadCatalogue();
}

let catalogue = null;
async function loadCatalogue() {
    if (!catalogue) {
        try {
            catalogue = (await apiFetch("/api/skills")).skills.map(s => s.name);
        } catch {
            catalogue = [];
        }
    }
    const list = document.getElementById("skillCatalogue");
    if (list) list.innerHTML = catalogue.map(name => `<option value="${escapeHTML(name)}">`).join("");
}

function markDirty() {
    dirty = true;
    render();
}

container.addEventListener("submit", event => {
    if (event.target.id !== "addSkillForm") return;
    event.preventDefault();

    const name = document.getElementById("newSkill").value.trim();
    const level = document.getElementById("newLevel").value;

    if (!name) {
        showMessage("Type a skill name first.");
        return;
    }
    if (skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        showMessage(`"${name}" is already in your list.`);
        return;
    }
    if (skills.length >= 30) {
        showMessage("You can list up to 30 skills.");
        return;
    }

    skills.push({ name, level });
    markDirty();
    document.getElementById("newSkill").focus();
});

container.addEventListener("change", event => {
    const select = event.target.closest("[data-level]");
    if (!select) return;
    skills[Number(select.dataset.level)].level = select.value;
    markDirty();
});

container.addEventListener("click", async event => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
        skills.splice(Number(remove.dataset.remove), 1);
        markDirty();
        return;
    }

    if (event.target.id === "saveSkills") {
        const button = event.target;
        button.disabled = true;
        button.textContent = "Saving…";
        try {
            await apiFetch("/api/learners/skills", { method: "PUT", body: { skills } });
            dirty = false;
            render();
            showMessage("Skills saved. Employers now see them with your proficiency levels.", "success");
        } catch (error) {
            button.disabled = false;
            button.textContent = "Save changes";
            showMessage(error.message);
        }
    }
});

window.addEventListener("beforeunload", event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = "";
    }
});

async function loadSkills() {
    requireLogin();
    container.innerHTML = '<p style="color:#64748b;">Loading skills…</p>';

    try {
        const { profile } = await apiFetch("/api/learners/profile");
        const levels = profile.skill_levels || {};
        skills = (profile.skills || []).map(name => ({ name, level: levels[name] || "Beginner" }));
        render();
    } catch (error) {
        if (/not found/i.test(error.message)) {
            container.innerHTML = `
                <div style="text-align:center;padding:24px;">
                    <h3>Create your profile first</h3>
                    <p style="color:#64748b;margin-top:8px;">Your skills are part of your learner profile.</p>
                    <a href="/learner/edit-profile.html" class="btn btn-primary" style="margin-top:16px;">Create profile</a>
                </div>`;
            return;
        }
        showMessage(error.message);
    }
}

document.addEventListener("DOMContentLoaded", loadSkills);
