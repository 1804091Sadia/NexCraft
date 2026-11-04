
let currentJobId = null;

const token =
    localStorage.getItem("nexcraft_token");


if (!token) {
    window.location.href = "/login.html";
}


const params =
    new URLSearchParams(
        window.location.search
    );


const jobId =
    params.get("id");

currentJobId = jobId;


const jobContainer =
    document.getElementById("jobContainer");


const messageBox =
    document.getElementById("message");


// Message
function showMessage(message, type) {

    messageBox.textContent = message;

    messageBox.className =
        `alert alert-${type}`;

    messageBox.style.display = "block";
}


// Escape HTML
function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// Format date
function formatDate(date) {

    if (!date) {
        return "Not specified";
    }

    const d =
        new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "Not specified";
    }

    return d.toLocaleDateString();
}


// Load job
async function loadJob() {

    if (!jobId) {

        jobContainer.innerHTML = `

            <div class="card">

                <h2>
                    Job not found
                </h2>

                <p>
                    No job was selected.
                </p>

            </div>

        `;

        return;
    }


    try {

        const response =
            await fetch(
                `/api/jobs/${encodeURIComponent(jobId)}`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load job"
            );

        }


        const job =
            data.job;


        displayJob(job);

        // Check whether this job is already saved
        await loadSavedStatus();


    } catch (error) {

        console.error(
            "Job details error:",
            error
        );


        jobContainer.innerHTML = `

            <div class="card">

                <h2>
                    Unable to load job
                </h2>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }
}


// Display job
function displayJob(job) {

    jobContainer.innerHTML = `

        <div
            style="
                display:grid;
                grid-template-columns:
                    2fr 1fr;
                gap:24px;
                align-items:start;
            "
        >


            <!-- Main information -->

            <div class="card">

                <div
                    style="
                        display:flex;
                        justify-content:
                            space-between;
                        align-items:
                            flex-start;
                        gap:20px;
                    "
                >

                    <div>

                        <h1>
                            ${escapeHTML(
                                job.title ||
                                "Untitled Job"
                            )}
                        </h1>

                        <p
                            style="
                                color:var(--muted);
                                font-size:17px;
                            "
                        >
                            ${escapeHTML(
                                job.company_name ||
                                job.company ||
                                "Company"
                            )}
                        </p>

                    </div>


                    <span
                        style="
                            background:
                                var(--primary-light);
                            color:
                                var(--primary);
                            padding:
                                8px 14px;
                            border-radius:8px;
                            font-weight:600;
                        "
                    >
                        ${escapeHTML(
                            job.job_type ||
                            "Job"
                        )}
                    </span>

                    ${job.salary_min || job.salary_max ? `
                    <span style="background:#ecfdf5;color:#047857;padding:8px 14px;border-radius:8px;font-weight:600;">
                        💰 ${escapeHTML(formatSalary(job.salary_min, job.salary_max))}
                    </span>` : ""}

                </div>


                <hr
                    style="
                        border:none;
                        border-top:
                            1px solid var(--border);
                        margin:25px 0;
                    "
                >


                <h2>
                    Job Description
                </h2>


                <div
                    style="
                        margin-top:15px;
                        line-height:1.8;
                        white-space:pre-line;
                    "
                >
                    ${escapeHTML(
                        job.description ||
                        "No description provided."
                    )}
                </div>


                ${
                    job.requirements
                    ? `

                        <h2
                            style="
                                margin-top:30px;
                            "
                        >
                            Requirements
                        </h2>

                        <div
                            style="
                                margin-top:15px;
                                line-height:1.8;
                                white-space:pre-line;
                            "
                        >
                            ${escapeHTML(
                                job.requirements
                            )}
                        </div>

                    `
                    : ""
                }


                ${
                    job.responsibilities
                    ? `

                        <h2
                            style="
                                margin-top:30px;
                            "
                        >
                            Responsibilities
                        </h2>

                        <div
                            style="
                                margin-top:15px;
                                line-height:1.8;
                                white-space:pre-line;
                            "
                        >
                            ${escapeHTML(
                                job.responsibilities
                            )}
                        </div>

                    `
                    : ""
                }

            </div>



            <!-- Job summary -->

            <div class="card">

                <h2>
                    Job Summary
                </h2>


                <div
                    style="
                        margin-top:20px;
                        line-height:2;
                    "
                >

                    <div>

                        <strong>
                            Location:
                        </strong>

                        <br>

                        ${escapeHTML(
                            job.location ||
                            "Not specified"
                        )}

                    </div>


                    <div
                        style="
                            margin-top:15px;
                        "
                    >

                        <strong>
                            Job Type:
                        </strong>

                        <br>

                        ${escapeHTML(
                            job.job_type ||
                            "Not specified"
                        )}

                    </div>


                    <div
                        style="
                            margin-top:15px;
                        "
                    >

                        <strong>
                            Category:
                        </strong>

                        <br>

                        ${escapeHTML(
                            job.category ||
                            "Not specified"
                        )}

                    </div>


                    <div
                        style="
                            margin-top:15px;
                        "
                    >

                        <strong>
                            Posted:
                        </strong>

                        <br>

                        ${formatDate(
                            job.created_at
                        )}

                    </div>

                </div>


                <!-- Save Job -->

                <button
                    id="saveJobButton"
                    class="btn btn-outline"
                    style="
                        width:100%;
                        margin-top:30px;
                    "
                    onclick="toggleSaveJob()"
                >
                    Save Job
                </button>


                <!-- Apply -->

                <button
                    id="applyButton"
                    class="btn btn-primary"
                    style="
                        width:100%;
                        margin-top:10px;
                    "
                    onclick="applyForJob()"
                >
                    Apply for this Job
                </button>

            </div>

        </div>

    `;
}


// Load saved status
async function loadSavedStatus() {

    const button =
        document.getElementById(
            "saveJobButton"
        );


    if (!button || !currentJobId) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/saved-jobs/check/${
                    encodeURIComponent(
                        currentJobId
                    )
                }`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (response.ok && data.saved) {

            button.textContent =
                "Saved";

            button.classList.remove(
                "btn-outline"
            );

            button.classList.add(
                "btn-primary"
            );

        }

    } catch (error) {

        console.error(
            "Check saved status error:",
            error
        );

    }
}


// Save / remove saved job
async function toggleSaveJob() {

    const button =
        document.getElementById(
            "saveJobButton"
        );


    if (!button || !currentJobId) {
        return;
    }


    const isSaved =
        button.textContent.trim() === "Saved";


    try {

        if (!isSaved) {

            const response =
                await fetch(
                    "/api/saved-jobs",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body: JSON.stringify({
                            job_id:
                                currentJobId
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to save job"
                );

            }


            button.textContent =
                "Saved";


            button.classList.remove(
                "btn-outline"
            );


            button.classList.add(
                "btn-primary"
            );


        } else {

            const response =
                await fetch(
                    `/api/saved-jobs/${
                        encodeURIComponent(
                            currentJobId
                        )
                    }`,
                    {
                        method: "DELETE",

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
                    "Failed to remove saved job"
                );

            }


            button.textContent =
                "Save Job";


            button.classList.remove(
                "btn-primary"
            );


            button.classList.add(
                "btn-outline"
            );

        }

    } catch (error) {

        console.error(
            "Toggle save job error:",
            error
        );


        alert(
            error.message ||
            "Something went wrong"
        );

    }
}


// Apply
function applyForJob() {

    window.location.href =
        `/learner/apply.html?job_id=${
            encodeURIComponent(jobId)
        }`;

}


// Start
loadJob();

