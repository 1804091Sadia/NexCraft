/*
    NexCraft Trainer Statistics
    ----------------------------
    Loads trainer program and enrollment
    statistics from the backend.

    MongoDB Native Driver backend.
*/


document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAuthentication();

        loadStatistics();

        setupLogout();

    }
);


// ==========================================
// AUTHENTICATION
// ==========================================

function checkAuthentication() {

    const token =
        localStorage.getItem("nexcraft_token");

    if (!token) {

        window.location.href =
            "/login.html";

    }

}


// ==========================================
// LOAD STATISTICS
// ==========================================

async function loadStatistics() {

    const token =
        localStorage.getItem("nexcraft_token");

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
                "Unable to load statistics."
            );

        }


        renderStatistics(data);

    } catch (error) {

        console.error(
            "Statistics loading error:",
            error
        );

        showError(
            error.message ||
            "Unable to load trainer statistics."
        );

    }

}


// ==========================================
// RENDER STATISTICS
// ==========================================

function renderStatistics(data) {

    const statistics =
        data.statistics || {};

    const programs =
        statistics.programs || {};

    const enrollments =
        statistics.enrollments || {};


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


    renderProgramEnrollmentCounts(
        data.programEnrollmentCounts || []
    );

}


// ==========================================
// PROGRAM TABLE
// ==========================================

function renderProgramEnrollmentCounts(
    programs
) {

    const tbody =
        document.getElementById(
            "programStatsBody"
        );


    if (!tbody) {
        return;
    }


    if (!programs.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="3"
                    class="empty-state"
                >
                    No training programs found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        programs
            .map(program => {

                const status =
                    String(
                        program.status ||
                        "Draft"
                    );


                return `
                    <tr>

                        <td>
                            <span class="program-title">
                                ${escapeHTML(
                                    program.title ||
                                    "Untitled Program"
                                )}
                            </span>
                        </td>

                        <td>
                            ${createStatusBadge(status)}
                        </td>

                        <td>
                            ${Number(
                                program.enrollment_count ||
                                0
                            )}
                        </td>

                    </tr>
                `;

            })
            .join("");

}


// ==========================================
// STATUS BADGE
// ==========================================

function normalizeStatus(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

}

function createStatusBadge(status) {

    const normalized =
        normalizeStatus(status);


    let className =
        "status-closed";


    if (normalized === "draft") {

        className =
            "status-draft";

    } else if (
        normalized === "pending approval" ||
        normalized.includes("pending") && normalized.includes("approval")
    ) {

        className =
            "status-pending";

    } else if (
        normalized === "active"
    ) {

        className =
            "status-active";

    } else if (
        normalized === "rejected"
    ) {

        className =
            "status-rejected";

    } else if (
        normalized === "closed"
    ) {

        className =
            "status-closed";

    }


    return `
        <span class="status-badge ${className}">
            ${escapeHTML(status || "Draft")}
        </span>
    `;

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
// ERROR MESSAGE
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
// TEXT HELPER
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
// HTML ESCAPE
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}