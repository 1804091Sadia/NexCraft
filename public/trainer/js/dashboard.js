/*
    NexCraft Trainer Dashboard
    ---------------------------
    Loads:
    - Trainer information
    - Program statistics
    - Enrollment statistics
    - Program enrollment counts
*/


document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAuthentication();

        loadDashboard();

        setupLogout();

    }
);


// ==========================================
// AUTHENTICATION
// ==========================================

function checkAuthentication() {

    const token =
        localStorage.getItem(
            "nexcraft_token"
        );

    if (!token) {

        window.location.href =
            "/login.html";

    }

}


// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboard() {

    const token =
        localStorage.getItem(
            "nexcraft_token"
        );

    if (!token) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/trainers/stats",
                {
                    method: "GET",

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


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load dashboard."
            );

        }


        renderDashboard(data);


    } catch (error) {

        console.error(
            "Trainer dashboard error:",
            error
        );

        showError(
            error.message ||
            "Unable to load dashboard."
        );

    }

}


// ==========================================
// RENDER DASHBOARD
// ==========================================

function renderDashboard(data) {

    const statistics =
        data.statistics || {};

    const programs =
        statistics.programs || {};

    const enrollments =
        statistics.enrollments || {};


    // -----------------------------
    // PROGRAMS
    // -----------------------------

    setText(
        "totalPrograms",
        programs.total || 0
    );


    setText(
        "draftPrograms",
        programs.draft || 0
    );


    setText(
        "pendingPrograms",
        programs.pendingApproval || 0
    );


    setText(
        "activePrograms",
        programs.active || 0
    );


    // -----------------------------
    // ENROLLMENTS
    // -----------------------------

    setText(
        "totalEnrollments",
        enrollments.total || 0
    );


    setText(
        "enrolledLearners",
        enrollments.enrolled || 0
    );


    setText(
        "inProgressLearners",
        enrollments.inProgress || 0
    );


    setText(
        "completedLearners",
        enrollments.completed || 0
    );


    // -----------------------------
    // PROGRAM LIST
    // -----------------------------

    renderPrograms(
        data.programEnrollmentCounts || []
    );

}


// ==========================================
// PROGRAM LIST
// ==========================================

function renderPrograms(programs) {

    const container =
        document.getElementById(
            "programList"
        );


    if (!container) {
        return;
    }


    if (!programs.length) {

        container.innerHTML = `
            <div class="empty-state">
                No training programs found.
                <br><br>

                <a
                    href="/trainer/programs.html"
                    style="
                        color:#2563eb;
                        font-weight:650;
                        text-decoration:none;
                    "
                >
                    Create your first program →
                </a>
            </div>
        `;

        return;
    }


    container.innerHTML =
        programs
            .slice(0, 6)
            .map(program => {

                return `
                    <div class="program-row">

                        <div class="program-info">

                            <div class="program-name">
                                ${escapeHTML(
                                    program.title ||
                                    "Untitled Program"
                                )}
                            </div>

                            <div class="program-status">
                                ${escapeHTML(
                                    program.status ||
                                    "Draft"
                                )}
                            </div>

                        </div>


                        <div class="program-count">

                            ${Number(
                                program.enrollment_count ||
                                0
                            )}

                            ${Number(
                                program.enrollment_count ||
                                0
                            ) === 1
                                ? "learner"
                                : "learners"}

                        </div>

                    </div>
                `;

            })
            .join("");

}


// ==========================================
// LOGOUT
// ==========================================

function setupLogout() {

    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (!logoutBtn) {
        return;
    }


    logoutBtn.addEventListener(
        "click",
        event => {

            event.preventDefault();


            localStorage.removeItem(
                "nexcraft_token"
            );


            localStorage.removeItem(
                "nexcraft_user"
            );


            window.location.href =
                "/login.html";

        }
    );

}


// ==========================================
// ERROR
// ==========================================

function showError(message) {

    const errorBox =
        document.getElementById(
            "errorMessage"
        );


    if (!errorBox) {
        return;
    }


    errorBox.textContent =
        message;


    errorBox.style.display =
        "block";

}


// ==========================================
// TEXT
// ==========================================

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}