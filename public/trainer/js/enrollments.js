// ============================================================
// NexCraft - Trainer Enrollments
// File: public/trainer/js/enrollments.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("nexcraft_token");

    // --------------------------------------------------------
    // Authentication
    // --------------------------------------------------------

    if (!token) {
        window.location.href = "/login.html";
        return;
    }


    // --------------------------------------------------------
    // DOM Elements
    // --------------------------------------------------------

    const tableBody =
        document.getElementById("enrollmentTableBody");

    const searchInput =
        document.getElementById("searchInput");

    const statusFilter =
        document.getElementById("statusFilter");

    const messageBox =
        document.getElementById("message");

    const totalEnrollments =
        document.getElementById("totalEnrollments");

    const pendingEnrollments =
        document.getElementById("pendingEnrollments");

    const approvedEnrollments =
        document.getElementById("approvedEnrollments");

    const completedEnrollments =
        document.getElementById("completedEnrollments");

    const logoutBtn =
        document.getElementById("logoutBtn");


    // --------------------------------------------------------
    // State
    // --------------------------------------------------------

    let enrollments = [];


    // --------------------------------------------------------
    // Status Filter
    //
    // The Trainer/SRS lifecycle is:
    // Enrolled -> In Progress -> Completed
    //
    // The HTML was initially created with generic status
    // options. We normalize those options here so the actual
    // Trainer lifecycle is displayed.
    // --------------------------------------------------------

    normalizeStatusFilter();


    // --------------------------------------------------------
    // Initial Load
    // --------------------------------------------------------

    loadEnrollments();


    // --------------------------------------------------------
    // Search
    // --------------------------------------------------------

    if (searchInput) {

        searchInput.addEventListener("input", () => {
            renderEnrollments();
        });

    }


    // --------------------------------------------------------
    // Status Filter
    // --------------------------------------------------------

    if (statusFilter) {

        statusFilter.addEventListener("change", () => {
            renderEnrollments();
        });

    }


    // --------------------------------------------------------
    // Logout
    // --------------------------------------------------------

    if (logoutBtn) {

        logoutBtn.addEventListener("click", logoutUser);

    }


    // ========================================================
    // LOAD ENROLLMENTS
    // ========================================================

    async function loadEnrollments() {

        showLoading();

        try {

            const response = await fetch(
                "/api/trainers/enrollments",
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            );


            // ------------------------------------------------
            // Authentication failure
            // ------------------------------------------------

            if (response.status === 401) {

                localStorage.removeItem("nexcraft_token");

                window.location.href = "/login.html";

                return;

            }


            if (response.status === 403) {

                showMessage(
                    "You are not authorized to access Trainer enrollments.",
                    "error"
                );

                showEmptyState(
                    "Access restricted",
                    "Your account does not currently have permission to view Trainer enrollments."
                );

                return;

            }


            const data = await safeJson(response);


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to load enrollments."
                );

            }


            // ------------------------------------------------
            // Support common backend response shapes
            // ------------------------------------------------

            enrollments = extractEnrollments(data);


            updateStatistics();

            renderEnrollments();


        } catch (error) {

            console.error(
                "Trainer enrollment loading error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to connect to the server.",
                "error"
            );


            showEmptyState(
                "Unable to load enrollments",
                "Please make sure the NexCraft server is running and try again."
            );

        }

    }


    // ========================================================
    // EXTRACT ENROLLMENTS
    // ========================================================

    function extractEnrollments(data) {

        if (Array.isArray(data)) {
            return data;
        }


        if (Array.isArray(data.enrollments)) {
            return data.enrollments;
        }


        if (Array.isArray(data.data)) {
            return data.data;
        }


        if (
            data.data &&
            Array.isArray(data.data.enrollments)
        ) {
            return data.data.enrollments;
        }


        if (Array.isArray(data.results)) {
            return data.results;
        }


        return [];

    }


    // ========================================================
    // STATISTICS
    // ========================================================

    function updateStatistics() {

        const total =
            enrollments.length;


        const enrolled =
            enrollments.filter(
                item =>
                    normalizeStatus(
                        item.status
                    ) === "enrolled"
            ).length;


        const inProgress =
            enrollments.filter(
                item =>
                    normalizeStatus(
                        item.status
                    ) === "in_progress"
            ).length;


        const completed =
            enrollments.filter(
                item =>
                    normalizeStatus(
                        item.status
                    ) === "completed"
            ).length;


        if (totalEnrollments) {
            totalEnrollments.textContent = total;
        }


        // ----------------------------------------------------
        // The original HTML has "Pending" and "Approved"
        // cards. We use them for the actual Trainer lifecycle:
        //
        // Pending card -> Enrolled
        // Approved card -> In Progress
        // ----------------------------------------------------

        if (pendingEnrollments) {
            pendingEnrollments.textContent = enrolled;
        }


        if (approvedEnrollments) {
            approvedEnrollments.textContent = inProgress;
        }


        if (completedEnrollments) {
            completedEnrollments.textContent = completed;
        }

    }


    // ========================================================
    // RENDER ENROLLMENTS
    // ========================================================

    function renderEnrollments() {

        if (!tableBody) {
            return;
        }


        const searchTerm =
            searchInput
                ? searchInput.value
                    .trim()
                    .toLowerCase()
                : "";


        const selectedStatus =
            statusFilter
                ? normalizeFilterStatus(
                    statusFilter.value
                )
                : "all";


        const filtered =
            enrollments.filter(enrollment => {

                const status =
                    normalizeStatus(
                        enrollment.status
                    );


                // --------------------------------------------
                // Status filter
                // --------------------------------------------

                if (
                    selectedStatus !== "all" &&
                    status !== selectedStatus
                ) {
                    return false;
                }


                // --------------------------------------------
                // Search
                // --------------------------------------------

                if (!searchTerm) {
                    return true;
                }


                const learnerName =
                    getLearnerName(
                        enrollment
                    ).toLowerCase();


                const learnerEmail =
                    getLearnerEmail(
                        enrollment
                    ).toLowerCase();


                const programName =
                    getProgramName(
                        enrollment
                    ).toLowerCase();


                return (
                    learnerName.includes(searchTerm) ||
                    learnerEmail.includes(searchTerm) ||
                    programName.includes(searchTerm)
                );

            });


        if (filtered.length === 0) {

            showEmptyTable();

            return;

        }


        tableBody.innerHTML =
            filtered
                .map(
                    enrollment =>
                        createEnrollmentRow(
                            enrollment
                        )
                )
                .join("");


        attachActionEvents();

    }


    // ========================================================
    // CREATE TABLE ROW
    // ========================================================

    function createEnrollmentRow(enrollment) {

        const enrollmentId =
            getEnrollmentId(
                enrollment
            );


        const learnerName =
            getLearnerName(
                enrollment
            );


        const learnerEmail =
            getLearnerEmail(
                enrollment
            );


        const learnerPhoto =
            getLearnerPhoto(
                enrollment
            );


        const programName =
            getProgramName(
                enrollment
            );


        const enrollmentDate =
            getEnrollmentDate(
                enrollment
            );


        const status =
            normalizeStatus(
                enrollment.status
            );


        const initials =
            getInitials(
                learnerName
            );


        const safeName =
            escapeHTML(
                learnerName
            );


        const safeEmail =
            escapeHTML(
                learnerEmail
            );


        const safeProgram =
            escapeHTML(
                programName
            );


        const safeDate =
            escapeHTML(
                enrollmentDate
            );


        let avatarHTML;


        if (learnerPhoto) {

            avatarHTML = `
                <img
                    src="${escapeAttribute(learnerPhoto)}"
                    alt="${safeName}">
            `;

        } else {

            avatarHTML = escapeHTML(
                initials
            );

        }


        return `
            <tr>

                <td>

                    <div class="learner-cell">

                        <div class="learner-avatar">
                            ${avatarHTML}
                        </div>

                        <div class="learner-info">

                            <strong>
                                ${safeName}
                            </strong>

                            <span>
                                ${safeEmail}
                            </span>

                        </div>

                    </div>

                </td>


                <td>

                    <span class="program-name">
                        ${safeProgram}
                    </span>

                </td>


                <td>
                    ${safeDate}
                </td>


                <td>

                    <span class="enrollment-status ${getStatusClass(status)}">

                        ${getStatusLabel(status)}

                    </span>

                </td>


                <td>

                    <div class="enrollment-actions">

                        ${createActionButtons(
                            enrollmentId,
                            status
                        )}

                    </div>

                </td>

            </tr>
        `;

    }


    // ========================================================
    // ACTION BUTTONS
    // ========================================================

    function createActionButtons(
        enrollmentId,
        status
    ) {

        if (!enrollmentId) {

            return `
                <span style="
                    color:#94a3b8;
                    font-size: 12px;
                ">
                    No actions
                </span>
            `;

        }


        // ----------------------------------------------------
        // ENROLLED
        // ----------------------------------------------------

        if (status === "enrolled") {

            return `
                <button
                    type="button"
                    class="action-btn view-btn"
                    data-enrollment-id="${escapeAttribute(enrollmentId)}"
                    data-new-status="in_progress">

                    Start

                </button>
            `;

        }


        // ----------------------------------------------------
        // IN PROGRESS
        // ----------------------------------------------------

        if (status === "in_progress") {

            return `
                <button
                    type="button"
                    class="action-btn approve-btn"
                    data-enrollment-id="${escapeAttribute(enrollmentId)}"
                    data-new-status="completed">

                    Complete

                </button>
            `;

        }


        // ----------------------------------------------------
        // COMPLETED
        // ----------------------------------------------------

        if (status === "completed") {

            return `
                <span style="
                    color:#15803d;
                    font-size: 12px;
                    font-weight:700;
                ">
                    Completed
                </span>
            `;

        }


        return `
            <span style="
                color:#94a3b8;
                font-size: 12px;
            ">
                ${escapeHTML(
                    getStatusLabel(status)
                )}
            </span>
        `;

    }


    // ========================================================
    // ATTACH ACTION EVENTS
    // ========================================================

    function attachActionEvents() {

        const actionButtons =
            document.querySelectorAll(
                "[data-enrollment-id][data-new-status]"
            );


        actionButtons.forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const enrollmentId =
                        button.dataset.enrollmentId;


                    const newStatus =
                        button.dataset.newStatus;


                    await updateEnrollmentStatus(
                        enrollmentId,
                        newStatus,
                        button
                    );

                }
            );

        });

    }


    // ========================================================
    // UPDATE ENROLLMENT STATUS
    // ========================================================

    async function updateEnrollmentStatus(
        enrollmentId,
        newStatus,
        button
    ) {

        if (!enrollmentId) {

            showMessage(
                "Enrollment ID is missing.",
                "error"
            );

            return;

        }


        if (!newStatus) {
            return;
        }


        const originalText =
            button.textContent;


        button.disabled = true;

        button.textContent =
            "Updating...";


        try {

            const response =
                await fetch(
                    `/api/trainers/enrollments/${encodeURIComponent(
                        enrollmentId
                    )}/status`,
                    {
                        method: "PATCH",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            status: newStatus
                        })
                    }
                );


            if (response.status === 401) {

                localStorage.removeItem(
                    "nexcraft_token"
                );

                window.location.href =
                    "/login.html";

                return;

            }


            const data =
                await safeJson(response);


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to update enrollment status."
                );

            }


            // ------------------------------------------------
            // Update local state
            // ------------------------------------------------

            const index =
                enrollments.findIndex(
                    item =>
                        getEnrollmentId(
                            item
                        ) === enrollmentId
                );


            if (index !== -1) {

                enrollments[index].status =
                    newStatus;

            }


            updateStatistics();

            renderEnrollments();


            showMessage(
                `Enrollment updated to ${getStatusLabel(
                    newStatus
                )}.`,
                "success"
            );


        } catch (error) {

            console.error(
                "Enrollment status update error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to update enrollment.",
                "error"
            );


            button.disabled = false;

            button.textContent =
                originalText;

        }

    }


    // ========================================================
    // STATUS NORMALIZATION
    // ========================================================

    function normalizeStatus(status) {

        if (!status) {
            return "enrolled";
        }


        const value =
            String(status)
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");


        if (
            value === "enrolled" ||
            value === "enrollment" ||
            value === "pending"
        ) {
            return "enrolled";
        }


        if (
            value === "in_progress" ||
            value === "inprogress" ||
            value === "active"
        ) {
            return "in_progress";
        }


        if (
            value === "completed" ||
            value === "complete"
        ) {
            return "completed";
        }


        return value;

    }


    function normalizeFilterStatus(status) {

        if (!status || status === "all") {
            return "all";
        }


        return normalizeStatus(status);

    }


    function getStatusLabel(status) {

        switch (
            normalizeStatus(status)
        ) {

            case "enrolled":
                return "Enrolled";

            case "in_progress":
                return "In Progress";

            case "completed":
                return "Completed";

            default:
                return formatStatus(
                    status
                );

        }

    }


    function getStatusClass(status) {

        switch (
            normalizeStatus(status)
        ) {

            case "enrolled":
                return "status-pending";

            case "in_progress":
                return "status-approved";

            case "completed":
                return "status-completed";

            default:
                return "status-pending";

        }

    }


    function formatStatus(status) {

        if (!status) {
            return "Unknown";
        }


        return String(status)
            .replace(/[_-]+/g, " ")
            .replace(
                /\b\w/g,
                character =>
                    character.toUpperCase()
            );

    }


    // ========================================================
    // NORMALIZE FILTER UI
    // ========================================================

    function normalizeStatusFilter() {

        if (!statusFilter) {
            return;
        }


        statusFilter.innerHTML = `

            <option value="all">
                All Status
            </option>

            <option value="enrolled">
                Enrolled
            </option>

            <option value="in_progress">
                In Progress
            </option>

            <option value="completed">
                Completed
            </option>

        `;

    }


    // ========================================================
    // FIELD HELPERS
    // ========================================================

    function getEnrollmentId(item) {

        return String(
            item.enrollment_id ||
            item.enrollmentId ||
            item._id ||
            ""
        );

    }


    function getLearnerName(item) {

        return (
            item.learner_name ||
            item.learnerName ||
            item.fullName ||
            item.full_name ||
            item.learner?.fullName ||
            item.learner?.full_name ||
            item.user?.fullName ||
            item.user?.full_name ||
            "Unknown Learner"
        );

    }


    function getLearnerEmail(item) {

        return (
            item.learner_email ||
            item.learnerEmail ||
            item.email ||
            item.learner?.email ||
            item.user?.email ||
            "No email"
        );

    }


    function getLearnerPhoto(item) {

        return (
            item.learner_photo ||
            item.learnerPhoto ||
            item.profile_image ||
            item.profileImage ||
            item.photo ||
            item.learner?.profile_image ||
            item.learner?.profileImage ||
            item.learner?.photo ||
            item.user?.profile_image ||
            item.user?.profileImage ||
            item.user?.photo ||
            ""
        );

    }


    function getProgramName(item) {

        return (
            item.program_title ||
            item.programTitle ||
            item.program_name ||
            item.programName ||
            item.program?.title ||
            item.training_program?.title ||
            "Training Program"
        );

    }


    function getEnrollmentDate(item) {

        const value =
            item.enrolled_at ||
            item.enrolledAt ||
            item.created_at ||
            item.createdAt ||
            item.enrollment_date ||
            item.enrollmentDate;


        if (!value) {
            return "—";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }


        return date.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    }


    function getInitials(name) {

        if (!name) {
            return "L";
        }


        const parts =
            String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        if (parts.length === 1) {

            return parts[0]
                .substring(0, 2)
                .toUpperCase();

        }


        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();

    }


    // ========================================================
    // EMPTY / LOADING STATES
    // ========================================================

    function showLoading() {

        if (!tableBody) {
            return;
        }


        tableBody.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="loading-state">

                        <div class="loading-spinner"></div>

                        Loading enrollments...

                    </div>

                </td>

            </tr>

        `;

    }


    function showEmptyTable() {

        if (!tableBody) {
            return;
        }


        tableBody.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="empty-enrollments">

                        <div class="empty-enrollment-icon">
                            ♙
                        </div>

                        <h3>
                            No enrollments found
                        </h3>

                        <p>
                            There are no learner enrollments matching your current search or filter.
                        </p>

                    </div>

                </td>

            </tr>

        `;

    }


    function showEmptyState(
        title,
        description
    ) {

        if (!tableBody) {
            return;
        }


        tableBody.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="empty-enrollments">

                        <div class="empty-enrollment-icon">
                            !
                        </div>

                        <h3>
                            ${escapeHTML(title)}
                        </h3>

                        <p>
                            ${escapeHTML(description)}
                        </p>

                    </div>

                </td>

            </tr>

        `;

    }


    // ========================================================
    // MESSAGE
    // ========================================================

    function showMessage(
        message,
        type = "success"
    ) {

        if (!messageBox) {
            return;
        }


        messageBox.textContent =
            message;


        messageBox.style.display =
            "block";


        messageBox.style.padding =
            "10px 14px";


        messageBox.style.borderRadius =
            "10px";


        messageBox.style.fontSize =
            "11px";


        if (type === "error") {

            messageBox.style.background =
                "#fef2f2";

            messageBox.style.color =
                "#b91c1c";

            messageBox.style.border =
                "1px solid #fecaca";

        } else {

            messageBox.style.background =
                "#ecfdf5";

            messageBox.style.color =
                "#15803d";

            messageBox.style.border =
                "1px solid #bbf7d0";

        }


        clearTimeout(
            showMessage.timeout
        );


        showMessage.timeout =
            setTimeout(() => {

                messageBox.style.display =
                    "none";

            }, 4000);

    }


    // ========================================================
    // LOGOUT
    // ========================================================

    function logoutUser() {

        localStorage.removeItem(
            "nexcraft_token"
        );

        window.location.href =
            "/login.html";

    }


    // ========================================================
    // SAFE JSON
    // ========================================================

    async function safeJson(response) {

        const text =
            await response.text();


        if (!text) {
            return {};
        }


        try {

            return JSON.parse(text);

        } catch (error) {

            return {
                message: text
            };

        }

    }


    // ========================================================
    // SECURITY HELPERS
    // ========================================================

    function escapeHTML(value) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    function escapeAttribute(value) {

        return escapeHTML(
            value
        );

    }

});