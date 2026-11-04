const token =
    localStorage.getItem("nexcraft_token");


if (!token) {
    window.location.href = "/login.html";
}


// Escape HTML
function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Format date
function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date =
        new Date(dateValue);

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


// Load saved jobs
async function loadSavedJobs() {

    const container =
        document.getElementById(
            "savedJobsContainer"
        );


    try {

        const response =
            await fetch(
                "/api/saved-jobs",
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
                "Failed to load saved jobs"
            );

        }


        const savedJobs =
            data.savedJobs || [];


        // No saved jobs
        if (savedJobs.length === 0) {

            container.innerHTML = `

                <div
                    class="card"
                    style="
                        padding:50px;
                        text-align:center;
                    "
                >

                    <div
                        style="
                            font-size:42px;
                            margin-bottom:15px;
                        "
                    >
                        🔖
                    </div>


                    <h2
                        style="
                            margin-bottom:8px;
                        "
                    >
                        No Saved Jobs
                    </h2>


                    <p
                        style="
                            color:#64748b;
                            margin-bottom:20px;
                        "
                    >
                        Save jobs you are interested
                        in and find them here later.
                    </p>


                    <a
                        href="/learner/jobs.html"
                        class="btn btn-primary"
                    >
                        Find Jobs
                    </a>

                </div>

            `;

            return;
        }


        // Render saved jobs
        container.innerHTML =
            savedJobs
                .map(savedItem => {

                    const job =
                        savedItem.job;


                    // Job may no longer exist
                    if (!job) {

                        return `

                            <div
                                class="card"
                                style="
                                    padding:25px;
                                    margin-bottom:15px;
                                "
                            >

                                <p>
                                    This saved job
                                    is no longer available.
                                </p>


                                <button
                                    class="btn btn-outline"
                                    onclick="
                                        removeSavedJob(
                                            '${escapeHTML(
                                                savedItem.job_id
                                            )}'
                                        )
                                    "
                                >
                                    Remove
                                </button>

                            </div>

                        `;
                    }


                    return `

                        <div
                            class="card"
                            style="
                                padding:25px;
                                margin-bottom:15px;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    gap:20px;
                                    align-items:flex-start;
                                "
                            >

                                <div>

                                    <h2
                                        style="
                                            font-size:19px;
                                            margin-bottom:7px;
                                        "
                                    >
                                        ${escapeHTML(
                                            job.title ||
                                            "Untitled Job"
                                        )}
                                    </h2>


                                    <p
                                        style="
                                            color:#475569;
                                            margin-bottom:10px;
                                        "
                                    >
                                        ${escapeHTML(
                                            job.company ||
                                            "Company"
                                        )}
                                    </p>


                                    <div
                                        style="
                                            display:flex;
                                            gap:15px;
                                            flex-wrap:wrap;
                                            color:#64748b;
                                            font-size:13px;
                                        "
                                    >

                                        <span>
                                            📍
                                            ${escapeHTML(
                                                job.location ||
                                                "Location not specified"
                                            )}
                                        </span>


                                        <span>
                                            💼
                                            ${escapeHTML(
                                                job.job_type ||
                                                "Job type not specified"
                                            )}
                                        </span>


                                        <span>
                                            Saved
                                            ${formatDate(
                                                savedItem.created_at
                                            )}
                                        </span>

                                    </div>

                                </div>


                                <div
                                    style="
                                        display:flex;
                                        gap:10px;
                                        flex-shrink:0;
                                    "
                                >

                                    <button
                                        class="btn btn-outline"
                                        onclick="
                                            removeSavedJob(
                                                '${escapeHTML(
                                                    savedItem.job_id
                                                )}'
                                            )
                                        "
                                    >
                                        Remove
                                    </button>


                                    <button
                                        class="btn btn-primary"
                                        onclick="
                                            viewJob(
                                                '${escapeHTML(
                                                    savedItem.job_id
                                                )}'
                                            )
                                        "
                                    >
                                        View Job
                                    </button>

                                </div>

                            </div>

                        </div>

                    `;

                })
                .join("");


    } catch (error) {

        console.error(
            "Load saved jobs error:",
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

                <p>
                    Unable to load saved jobs.
                </p>

            </div>

        `;

    }
}


// View job
function viewJob(jobId) {

    window.location.href =
        `/learner/job-details.html?id=${
            encodeURIComponent(jobId)
        }`;

}


// Remove saved job
async function removeSavedJob(jobId) {

    try {

        const response =
            await fetch(
                `/api/saved-jobs/${
                    encodeURIComponent(jobId)
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


        await loadSavedJobs();


    } catch (error) {

        console.error(
            "Remove saved job error:",
            error
        );

        alert(
            error.message ||
            "Failed to remove saved job"
        );

    }

}


// Start
document.addEventListener(
    "DOMContentLoaded",
    loadSavedJobs
);