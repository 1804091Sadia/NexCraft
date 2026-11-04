const token =
    localStorage.getItem("nexcraft_token");


if (!token) {

    window.location.href =
        "/login.html";
}


const params =
    new URLSearchParams(
        window.location.search
    );


const jobId =
    params.get("job_id");


const jobSummary =
    document.getElementById(
        "jobSummary"
    );


const cvStatus =
    document.getElementById(
        "cvStatus"
    );


const form =
    document.getElementById(
        "applicationForm"
    );


const submitButton =
    document.getElementById(
        "submitApplicationButton"
    );


const messageBox =
    document.getElementById(
        "message"
    );


// Show message
function showMessage(message, type) {

    messageBox.textContent =
        message;

    messageBox.className =
        `alert alert-${type}`;

    messageBox.style.display =
        "block";
}


// Escape HTML
function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// Load job
async function loadJob() {

    if (!jobId) {

        jobSummary.innerHTML = `

            <h2>
                Job not found
            </h2>

            <p>
                No job was selected.
            </p>

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


        jobSummary.innerHTML = `

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
                    margin-top:8px;
                "
            >
                ${escapeHTML(
                    job.company_name ||
                    "Company"
                )}
            </p>


            <hr
                style="
                    border:none;
                    border-top:
                        1px solid var(--border);
                    margin:25px 0;
                "
            >


            <div
                style="
                    line-height:2;
                "
            >

                <div>
                    <strong>
                        Location:
                    </strong>

                    ${escapeHTML(
                        job.location ||
                        "Not specified"
                    )}
                </div>


                <div>
                    <strong>
                        Job Type:
                    </strong>

                    ${escapeHTML(
                        job.job_type ||
                        "Not specified"
                    )}
                </div>


                <div>
                    <strong>
                        Category:
                    </strong>

                    ${escapeHTML(
                        job.category ||
                        "Not specified"
                    )}
                </div>

            </div>


            <h2
                style="
                    margin-top:30px;
                "
            >
                Job Description
            </h2>


            <p
                style="
                    margin-top:12px;
                    line-height:1.8;
                    white-space:pre-line;
                "
            >
                ${escapeHTML(
                    job.description ||
                    "No description provided."
                )}
            </p>

        `;


    } catch (error) {

        console.error(
            "Job loading error:",
            error
        );


        jobSummary.innerHTML = `

            <h2>
                Unable to load job
            </h2>

            <p>
                ${escapeHTML(
                    error.message
                )}
            </p>

        `;

    }
}


// Check learner profile / CV
async function checkProfile() {

    try {

        const response =
            await fetch(
                "/api/learners/profile",
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

            cvStatus.innerHTML = `
                Please complete your
                learner profile first.
            `;

            return;
        }


        if (!data.profile.cv) {

            cvStatus.innerHTML = `

                <span
                    style="
                        color:var(--danger);
                    "
                >
                    No CV uploaded.
                </span>

                <br><br>

                <a
                    href="/learner/edit-profile.html"
                    class="btn btn-secondary"
                >
                    Upload CV
                </a>

            `;

            submitButton.disabled =
                true;

            return;
        }


        cvStatus.innerHTML = `

            <span
                style="
                    color:var(--success);
                    font-weight:600;
                "
            >
                ✓ CV available
            </span>

            <br>

            <a
                href="#"
                data-cv="me"
            >
                View current CV
            </a>

        `;


    } catch (error) {

        console.error(
            "Profile check error:",
            error
        );

    }
}


// Submit application
form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!jobId) {

            showMessage(
                "Invalid job.",
                "error"
            );

            return;
        }


        const coverLetter =
            document.getElementById(
                "coverLetter"
            ).value.trim();


        if (!coverLetter) {

            showMessage(
                "Please write a cover letter.",
                "error"
            );

            return;
        }


        submitButton.disabled =
            true;

        submitButton.textContent =
            "Submitting...";


        try {

            const response =
                await fetch(
                    "/api/applications",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${token}`
                        },

                        body: JSON.stringify({

                            job_id:
                                jobId,

                            cover_letter:
                                coverLetter

                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Unable to submit application"
                );

            }


            showMessage(
                "Application submitted successfully.",
                "success"
            );


            setTimeout(
                function () {

                    window.location.href =
                        "/learner/applications.html";

                },
                1000
            );


        } catch (error) {

            console.error(
                "Application error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to submit application.",
                "error"
            );


            submitButton.disabled =
                false;

            submitButton.textContent =
                "Submit Application";

        }

    }
);


// Start
loadJob();
checkProfile();