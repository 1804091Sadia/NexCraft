const token = localStorage.getItem("nexcraft_token");

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

    const date = new Date(dateValue);

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}


let allJobs = [];


// Load jobs
async function loadJobs() {
    const container =
        document.getElementById("jobsContainer");

    try {
        const response = await fetch("/api/jobs", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to load jobs"
            );
        }

        allJobs = data.jobs || [];

        displayJobs(allJobs);

    } catch (error) {
        console.error("Load jobs error:", error);

        container.innerHTML = `
            <div class="card" style="padding:40px;text-align:center;">
                <p>Unable to load jobs.</p>
            </div>
        `;
    }
}


// Display jobs
async function displayJobs(jobs) {
    const container =
        document.getElementById("jobsContainer");

    if (!jobs || jobs.length === 0) {
        container.innerHTML = `
            <div
                class="card"
                style="padding:40px;text-align:center;"
            >
                <h3>No jobs found</h3>

                <p style="color:#64748b;margin-top:8px;">
                    Try changing your search or filters.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML = jobs.map(job => {

        return `
            <div
                class="card job-card"
                style="padding:25px;"
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:20px;
                        align-items:flex-start;
                    "
                >

                    <div style="flex:1;">

                        <h2
                            style="
                                font-size:19px;
                                margin-bottom:7px;
                            "
                        >
                            ${escapeHTML(
                                job.title || "Untitled Job"
                            )}
                        </h2>


                        <p
                            style="
                                color:#475569;
                                margin-bottom:12px;
                            "
                        >
                            ${escapeHTML(
                                job.company || "Company"
                            )}
                        </p>


                        <div
                            style="
                                display:flex;
                                gap:15px;
                                flex-wrap:wrap;
                                color:#64748b;
                                font-size:13px;
                                margin-bottom:15px;
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

                            ${job.salary_min || job.salary_max
                                ? `<span>💰 ${escapeHTML(formatSalary(job.salary_min, job.salary_max))}</span>`
                                : ""}

                            <span>
                                📅
                                ${formatDate(job.created_at)}
                            </span>

                        </div>


                        <p
                            style="
                                color:#475569;
                                font-size:14px;
                                line-height:1.6;
                            "
                        >
                            ${escapeHTML(
                                job.description || ""
                            ).substring(0, 180)}
                            ${job.description &&
                            job.description.length > 180
                                ? "..."
                                : ""}
                        </p>

                    </div>


                    <div
                        style="
                            display:flex;
                            flex-direction:column;
                            gap:10px;
                            flex-shrink:0;
                        "
                    >

                        <button
                            class="btn btn-outline"
                            onclick="
                                toggleSaveJob(
                                    '${escapeHTML(job.job_id)}',
                                    this
                                )
                            "
                        >
                            Save Job
                        </button>


                        <button
                            class="btn btn-primary"
                            onclick="
                                viewJob(
                                    '${escapeHTML(job.job_id)}'
                                )
                            "
                        >
                            View Details
                        </button>

                    </div>

                </div>

            </div>
        `;

    }).join("");


    // Check saved status for each job
    const saveButtons =
        container.querySelectorAll(
            "button[onclick^='toggleSaveJob']"
        );

    for (let i = 0; i < jobs.length; i++) {

        const button = saveButtons[i];

        if (!button) {
            continue;
        }

        try {

            const response = await fetch(
                `/api/saved-jobs/check/${
                    encodeURIComponent(jobs[i].job_id)
                }`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok && data.saved) {
                button.textContent = "Saved";
                button.classList.remove("btn-outline");
                button.classList.add("btn-primary");
            }

        } catch (error) {

            console.error(
                "Check saved job error:",
                error
            );

        }
    }
}


// Save / unsave job
async function toggleSaveJob(jobId, button) {

    const isSaved =
        button.textContent.trim() === "Saved";


    try {

        if (!isSaved) {

            const response = await fetch(
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
                        job_id: jobId
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


            button.textContent = "Saved";

            button.classList.remove(
                "btn-outline"
            );

            button.classList.add(
                "btn-primary"
            );


        } else {

            const response = await fetch(
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


            button.textContent = "Save Job";

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


// View job details
function viewJob(jobId) {

    window.location.href =
        `/learner/job-details.html?id=${
            encodeURIComponent(jobId)
        }`;

}


// Apply filters (FR-11: keyword, location, type, category, skill, salary)
function filterValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.toLowerCase().trim() : "";
}

function filterJobs() {
    const search = filterValue("search");
    const location = filterValue("location");
    const jobType = filterValue("jobType");
    const category = filterValue("category");
    const skill = filterValue("skill");
    const salaryMin = Number(filterValue("salaryMin")) || 0;

    const filteredJobs = allJobs.filter(job => {
        const text = [job.title, job.company, job.description]
            .map(value => String(value || "").toLowerCase())
            .join(" ");

        const skills = (job.skill_tags || []).map(s => String(s).toLowerCase());

        return (!search || text.includes(search)) &&
            (!location || String(job.location || "").toLowerCase().includes(location)) &&
            (!jobType || String(job.job_type || "").toLowerCase() === jobType) &&
            (!category || String(job.category || "").toLowerCase() === category) &&
            (!skill || skills.some(s => s.includes(skill))) &&
            (!salaryMin || Number(job.salary_max || job.salary_min || 0) >= salaryMin);
    });

    displayJobs(filteredJobs);
}

// Fill the category list from the jobs that exist
function fillCategories() {
    const select = document.getElementById("category");
    if (!select || select.options.length > 1) return;

    [...new Set(allJobs.map(job => job.category).filter(Boolean))]
        .sort()
        .forEach(category => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
}


// Start
document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadJobs();
        fillCategories();

        ["search", "location", "skill", "salaryMin"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", filterJobs);
        });

        ["jobType", "category"].forEach(id => {
            document.getElementById(id)?.addEventListener("change", filterJobs);
        });

        document.getElementById("searchButton")?.addEventListener("click", event => {
            event.preventDefault();
            filterJobs();
        });
    }
);
