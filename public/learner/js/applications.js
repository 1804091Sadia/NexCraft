const token = localStorage.getItem("nexcraft_token");

if (!token) {
    window.location.href = "/login.html";
}


// Escape HTML
function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Format date
function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date =
        new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "—";
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


// Show message
function showMessage(
    message,
    type = "error"
) {

    const messageBox =
        document.getElementById("message");

    if (!messageBox) return;

    messageBox.textContent =
        message;

    messageBox.style.display =
        "block";

    messageBox.className =
        `alert ${type}`;
}


// Load applications
async function loadApplications() {

    const container =
        document.getElementById(
            "applicationsContainer"
        );


    try {

        const response =
            await fetch(
                "/api/applications",
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to load applications"
            );
        }


        const applications =
            data.applications || [];


        if (applications.length === 0) {

            container.innerHTML = `
                <div
                    class="card"
                    style="
                        padding:50px;
                        text-align:center;
                    "
                >

                    <div style="
                        font-size:40px;
                        margin-bottom:12px;
                    ">
                        📄
                    </div>

                    <h2 style="
                        margin-bottom:8px;
                    ">
                        No applications yet
                    </h2>

                    <p style="
                        color:#64748b;
                        margin-bottom:20px;
                    ">
                        You have not applied
                        for any jobs yet.
                    </p>

                    <a
                        href="/learner/jobs.html"
                        class="btn btn-primary">

                        Find Jobs

                    </a>

                </div>
            `;

            return;
        }


        container.innerHTML =
            applications
                .map(application => {

                    const job =
                        application.job || {};


                    return `
                        <div
                            class="card"
                            style="
                                padding:24px;
                                margin-bottom:18px;
                            "
                        >

                            <div style="
                                display:flex;
                                justify-content:
                                    space-between;
                                align-items:
                                    flex-start;
                                gap:20px;
                            ">

                                <div>

                                    <h2 style="
                                        margin-bottom:7px;
                                    ">
                                        ${escapeHTML(
                                            job.title ||
                                            "Job"
                                        )}
                                    </h2>


                                    <p style="
                                        color:#64748b;
                                        margin-bottom:10px;
                                    ">
                                        ${escapeHTML(
                                            job.company ||
                                            ""
                                        )}
                                    </p>


                                    <p style="
                                        color:#64748b;
                                        font-size:13px;
                                    ">
                                        ${application.reference_no
                                            ? "Ref: " + escapeHTML(application.reference_no) + " · "
                                            : ""}
                                        Applied:
                                        ${formatDate(
                                            application.created_at
                                        )}
                                    </p>

                                </div>


                                <span style="
                                    background:#eff6ff;
                                    color:#2563eb;
                                    padding:6px 12px;
                                    border-radius:20px;
                                    font-size:12px;
                                    font-weight:600;
                                ">
                                    ${escapeHTML(
                                        application.status ||
                                        "Applied"
                                    )}
                                </span>

                            </div>


                            <div style="
                                margin-top:18px;
                            ">

                                <a
                                    href="/learner/job-details.html?id=${encodeURIComponent(
                                        application.job_id
                                    )}"
                                    class="btn btn-secondary">

                                    View Job

                                </a>

                            </div>

                        </div>
                    `;

                })
                .join("");


    } catch (error) {

        console.error(
            "Applications loading error:",
            error
        );


        container.innerHTML = `
            <div
                class="card"
                style="
                    padding:40px;
                    text-align:center;
                "
            >

                <h2>
                    Unable to load applications
                </h2>

                <p style="
                    color:#64748b;
                    margin-top:8px;
                ">
                    Please try again later.
                </p>

            </div>
        `;

        showMessage(
            error.message ||
            "Unable to load applications."
        );
    }
}


// Withdraw (FR-37) — one delegated listener for all buttons
document.addEventListener("click", async event => {
    const button = event.target.closest("[data-withdraw]");
    if (!button) return;

    if (!confirm("Withdraw this application? The employer will be notified and you cannot undo this.")) {
        return;
    }

    button.disabled = true;
    button.textContent = "Withdrawing...";

    try {
        const response = await fetch(
            `/api/applications/${encodeURIComponent(button.dataset.withdraw)}/withdraw`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("nexcraft_token")}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to withdraw application");
        }

        loadApplications();

    } catch (error) {
        button.disabled = false;
        button.textContent = "Withdraw";
        showMessage(error.message);
    }
});


// Initial load
document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadApplications();

    }
);