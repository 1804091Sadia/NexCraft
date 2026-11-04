// ============================================================
// NEXCRAFT - TRAINER PROGRAMS
// ============================================================

const token =
    localStorage.getItem("nexcraft_token");


// ============================================================
// ELEMENTS
// ============================================================

const programContainer =
    document.getElementById("programContainer");

const messageBox =
    document.getElementById("message");

const createProgramBtn =
    document.getElementById("createProgramBtn");

const programModal =
    document.getElementById("programModal");

const closeModalBtn =
    document.getElementById("closeModalBtn");

const cancelBtn =
    document.getElementById("cancelBtn");

const programForm =
    document.getElementById("programForm");

const modalTitle =
    document.getElementById("modalTitle");

const saveProgramBtn =
    document.getElementById("saveProgramBtn");

const logoutBtn =
    document.getElementById("logoutBtn");


// FORM FIELDS

const titleInput =
    document.getElementById("title");

const categoryInput =
    document.getElementById("category");

const modeInput =
    document.getElementById("mode");

const durationInput =
    document.getElementById("duration");

const levelInput =
    document.getElementById("level");

const skillTagsInput =
    document.getElementById("skill_tags");

const descriptionInput =
    document.getElementById("description");

const prerequisitesInput =
    document.getElementById("prerequisites");


// ============================================================
// STATE
// ============================================================

let editingProgramId = null;


// ============================================================
// AUTH
// ============================================================

if (!token) {

    window.location.href =
        "/login.html";

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
    message,
    type = "error"
) {

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

}


// ============================================================
// MODAL
// ============================================================

function openModal(program = null) {

    programForm.reset();

    editingProgramId = null;


    if (program) {

        editingProgramId =
            program.program_id;


        modalTitle.textContent =
            "Edit Training Program";


        saveProgramBtn.textContent =
            "Save Changes";


        titleInput.value =
            program.title || "";


        categoryInput.value =
            program.category || "";


        modeInput.value =
            program.mode || "";


        durationInput.value =
            program.duration || "";


        levelInput.value =
            program.level || "";


        skillTagsInput.value =
            Array.isArray(program.skill_tags)
                ? program.skill_tags.join(", ")
                : "";


        descriptionInput.value =
            program.description || "";


        prerequisitesInput.value =
            program.prerequisites || "";

    } else {

        modalTitle.textContent =
            "Create Training Program";


        saveProgramBtn.textContent =
            "Save as Draft";

    }


    programModal.classList.add("show");

}


function closeModal() {

    programModal.classList.remove(
        "show"
    );

    programForm.reset();

    editingProgramId = null;

}


// ============================================================
// STATUS LABEL
// ============================================================

function getStatusLabel(status) {

    const labels = {

        draft: "Draft",

        pending_approval:
            "Pending Approval",

        active:
            "Active",

        rejected:
            "Rejected",

        closed:
            "Closed"

    };

    return labels[status] || status;

}


// ============================================================
// STATUS CLASS
// ============================================================

function getStatusClass(status) {

    const classes = {

        draft:
            "status-draft",

        pending_approval:
            "status-pending",

        active:
            "status-active",

        rejected:
            "status-rejected",

        closed:
            "status-closed"

    };

    return classes[status] ||
        "status-draft";

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// RENDER PROGRAMS
// ============================================================

function renderPrograms(programs) {


    if (!programs.length) {

        programContainer.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ▣
                </div>

                <h3>
                    No training programs yet
                </h3>

                <p>
                    Create your first training program and
                    start sharing your expertise with learners.
                </p>

                <button
                    class="primary-btn"
                    onclick="openModal()"
                >
                    ＋ Create Program
                </button>

            </div>

        `;

        return;
    }


    programContainer.innerHTML = `

        <div class="program-grid">

            ${programs.map(program => {

                const skills =
                    Array.isArray(
                        program.skill_tags
                    )
                        ? program.skill_tags
                        : [];


                const skillHTML =
                    skills
                        .slice(0, 6)
                        .map(skill => `
                            <span class="skill-tag">
                                ${escapeHTML(skill)}
                            </span>
                        `)
                        .join("");


                let actions = "";


                if (
                    program.status === "draft" ||
                    program.status === "rejected"
                ) {

                    actions += `

                        <button
                            class="small-btn edit-btn"
                            onclick="editProgram('${program.program_id}')"
                        >
                            Edit
                        </button>

                        <button
                            class="small-btn submit-btn"
                            onclick="submitProgram('${program.program_id}')"
                        >
                            Submit
                        </button>

                    `;

                }


                if (
                    program.status === "active"
                ) {

                    actions += `

                        <button
                            class="small-btn close-btn"
                            onclick="closeProgram('${program.program_id}')"
                        >
                            Close
                        </button>

                    `;

                }


                return `

                    <article class="program-card">

                        <div class="program-card-top">

                            <span class="program-category">
                                ${escapeHTML(
                                    program.category
                                )}
                            </span>

                            <span
                                class="program-status
                                ${getStatusClass(
                                    program.status
                                )}"
                            >
                                ${getStatusLabel(
                                    program.status
                                )}
                            </span>

                        </div>


                        <h3>
                            ${escapeHTML(
                                program.title
                            )}
                        </h3>


                        <p class="program-description">
                            ${escapeHTML(
                                program.description
                            )}
                        </p>


                        <div class="program-meta">

                            <div class="meta-item">

                                <span>
                                    Mode
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        program.mode
                                    )}
                                </strong>

                            </div>


                            <div class="meta-item">

                                <span>
                                    Duration
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        program.duration
                                    )}
                                </strong>

                            </div>


                            <div class="meta-item">

                                <span>
                                    Learners
                                </span>

                                <strong>
                                    ${program.enrollment_count || 0}
                                </strong>

                            </div>


                            <div class="meta-item">

                                <span>
                                    Level
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        program.level || "—"
                                    )}
                                </strong>

                            </div>

                        </div>


                        ${
                            skillHTML
                                ? `
                                    <div class="skill-list">
                                        ${skillHTML}
                                    </div>
                                `
                                : ""
                        }


                        ${
                            program.rejection_reason
                                ? `
                                    <div
                                        style="
                                            margin-top:14px;
                                            padding:10px;
                                            background:#fff0f2;
                                            color:#dc4c64;
                                            border-radius:9px;
                                            font-size: 12px;
                                            line-height:1.5;
                                        "
                                    >
                                        <strong>
                                            Rejection reason:
                                        </strong>

                                        ${escapeHTML(
                                            program.rejection_reason
                                        )}
                                    </div>
                                `
                                : ""
                        }


                        ${
                            actions
                                ? `
                                    <div class="program-actions">
                                        ${actions}
                                    </div>
                                `
                                : ""
                        }

                    </article>

                `;

            }).join("")}

        </div>

    `;

}


// ============================================================
// LOAD PROGRAMS
// ============================================================

async function loadPrograms() {

    try {

        const response =
            await fetch(
                "/api/trainers/programs",
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (response.status === 401) {

            localStorage.removeItem(
                "nexcraft_token"
            );

            window.location.href =
                "/login.html";

            return;

        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Failed to load programs."
            );

        }


        renderPrograms(
            data.programs || []
        );


    } catch (error) {

        console.error(
            "Load programs error:",
            error
        );


        programContainer.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Unable to load programs
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}


// ============================================================
// GET SINGLE PROGRAM
// ============================================================

async function getProgram(programId) {

    const response =
        await fetch(
            `/api/trainers/programs/${encodeURIComponent(programId)}`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


    const data =
        await response.json();


    if (!response.ok || !data.success) {

        throw new Error(
            data.message ||
            "Failed to load program."
        );

    }


    return data.program;

}


// ============================================================
// EDIT
// ============================================================

async function editProgram(programId) {

    try {

        const program =
            await getProgram(
                programId
            );


        openModal(program);


    } catch (error) {

        showMessage(
            error.message
        );

    }

}


// ============================================================
// SUBMIT
// ============================================================

async function submitProgram(programId) {

    const confirmed =
        window.confirm(
            "Submit this program for Admin approval?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/trainers/programs/${encodeURIComponent(programId)}/submit`,
                {
                    method: "PATCH",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to submit program."
            );

        }


        showMessage(
            data.message,
            "success"
        );


        await loadPrograms();


    } catch (error) {

        showMessage(
            error.message
        );

    }

}


// ============================================================
// CLOSE
// ============================================================

async function closeProgram(programId) {

    const confirmed =
        window.confirm(
            "Close this active training program?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/trainers/programs/${encodeURIComponent(programId)}/close`,
                {
                    method: "PATCH",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to close program."
            );

        }


        showMessage(
            data.message,
            "success"
        );


        await loadPrograms();


    } catch (error) {

        showMessage(
            error.message
        );

    }

}


// ============================================================
// CREATE / UPDATE FORM
// ============================================================

programForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const skillTags =
            skillTagsInput.value
                .split(",")
                .map(skill => skill.trim())
                .filter(Boolean);


        const payload = {

            title:
                titleInput.value.trim(),

            category:
                categoryInput.value.trim(),

            mode:
                modeInput.value,

            duration:
                durationInput.value.trim(),

            level:
                levelInput.value,

            skill_tags:
                skillTags,

            description:
                descriptionInput.value.trim(),

            prerequisites:
                prerequisitesInput.value.trim()

        };


        saveProgramBtn.disabled = true;

        saveProgramBtn.textContent =
            "Saving...";


        try {

            const url =
                editingProgramId

                    ? `/api/trainers/programs/${encodeURIComponent(editingProgramId)}`

                    : "/api/trainers/programs";


            const method =
                editingProgramId
                    ? "PUT"
                    : "POST";


            const response =
                await fetch(
                    url,
                    {
                        method,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${token}`

                        },

                        body:
                            JSON.stringify(
                                payload
                            )

                    }
                );


            const data =
                await response.json();


            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    "Failed to save program."
                );

            }


            closeModal();


            showMessage(
                data.message,
                "success"
            );


            await loadPrograms();


        } catch (error) {

            showMessage(
                error.message
            );


        } finally {

            saveProgramBtn.disabled =
                false;


            saveProgramBtn.textContent =
                editingProgramId
                    ? "Save Changes"
                    : "Save as Draft";

        }

    }
);


// ============================================================
// MODAL EVENTS
// ============================================================

createProgramBtn.addEventListener(
    "click",
    function() {
        openModal();
    }
);


closeModalBtn.addEventListener(
    "click",
    closeModal
);


cancelBtn.addEventListener(
    "click",
    closeModal
);


programModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            programModal
        ) {

            closeModal();

        }

    }
);


// ============================================================
// LOGOUT
// ============================================================

logoutBtn.addEventListener(
    "click",
    function() {

        localStorage.removeItem(
            "nexcraft_token"
        );

        window.location.href =
            "/login.html";

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.openModal =
    openModal;

window.editProgram =
    editProgram;

window.submitProgram =
    submitProgram;

window.closeProgram =
    closeProgram;


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    loadPrograms
);