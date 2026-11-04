const token =
    localStorage.getItem("nexcraft_token");


if (!token) {
    window.location.href = "/login.html";
}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// FR-14 filters -> query string for GET /api/training
function programFilterQuery() {
    const params = new URLSearchParams();
    [["pq", "q"], ["pcategory", "category"], ["pmode", "mode"], ["plevel", "level"], ["pskill", "skill"]]
        .forEach(([id, key]) => {
            const value = document.getElementById(id)?.value.trim();
            if (value) params.set(key, value);
        });
    return params.toString();
}

let programCategoriesFilled = false;

async function fillProgramCategories() {
    if (programCategoriesFilled) return;
    programCategoriesFilled = true;
    try {
        const response = await fetch("/api/training", { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        const select = document.getElementById("pcategory");
        [...new Set((data.programs || []).map(p => p.category).filter(Boolean))].sort()
            .forEach(category => {
                const option = document.createElement("option");
                option.value = option.textContent = category;
                select.appendChild(option);
            });
    } catch { /* filters still work without the list */ }
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("programFilters");
    if (!form) return;

    fillProgramCategories();

    let timer;
    form.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(loadPrograms, 300);
    });
    form.addEventListener("submit", event => {
        event.preventDefault();
        loadPrograms();
    });
    document.getElementById("clearProgramFilters").addEventListener("click", () => {
        form.reset();
        loadPrograms();
    });
});

async function loadPrograms() {

    const container =
        document.getElementById(
            "programsContainer"
        );


    try {

        const response =
            await fetch(
                "/api/training?" + programFilterQuery(),
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
                "Failed to load programs"
            );
        }


        const programs =
            data.programs || [];


        if (programs.length === 0) {

            container.innerHTML = `
                <div class="card"
                    style="
                        padding:30px;
                        grid-column:1/-1;
                    "
                >
                    ${programFilterQuery()
                        ? "No programs match these filters. Try clearing them."
                        : "No training programs available yet. Check back soon."}
                </div>
            `;

            return;
        }


        container.innerHTML =
            programs.map(program => `

                <div class="card"
                    style="padding:25px;"
                >

                    <h2
                        style="
                            font-size:20px;
                            margin-bottom:8px;
                        "
                    >
                        ${escapeHTML(
                            program.title
                        )}
                    </h2>

                    <p
                        style="
                            color:#64748b;
                            margin-bottom:15px;
                        "
                    >
                        ${escapeHTML(
                            program.level ||
                            "Training Program"
                        )}
                    </p>

                    <p
                        style="
                            line-height:1.7;
                            color:#475569;
                            margin-bottom:20px;
                        "
                    >
                        ${escapeHTML(
                            program.description ||
                            "No description available."
                        )}
                    </p>

                    <button
                        class="btn btn-primary"
                        onclick="
                            enrollTraining(
                                '${escapeHTML(
                                    program.program_id
                                )}'
                            )
                        "
                    >
                        Enroll Now
                    </button>

                </div>

            `).join("");


    } catch (error) {

        console.error(
            "Load programs error:",
            error
        );

        container.innerHTML = `
            <div class="card"
                style="
                    padding:30px;
                    grid-column:1/-1;
                "
            >
                Unable to load training programs.
            </div>
        `;

    }

}


async function enrollTraining(programId) {

    try {

        const response =
            await fetch(
                "/api/enrollments",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        program_id: programId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Enrollment failed"
            );

        }


        alert(
            "Successfully enrolled in training program."
        );


        loadEnrollments();


    } catch (error) {

        alert(
            error.message ||
            "Unable to enroll"
        );

    }

}


async function loadEnrollments() {

    const container =
        document.getElementById(
            "enrollmentsContainer"
        );


    try {

        const response =
            await fetch(
                "/api/enrollments/my",
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
                "Failed to load enrollments"
            );

        }


        const enrollments =
            data.enrollments || [];


        if (enrollments.length === 0) {

            container.innerHTML = `
                <div
                    class="card"
                    style="
                        padding:30px;
                        text-align:center;
                    "
                >
                    You have not enrolled in
                    any training program yet.
                </div>
            `;

            return;
        }


        container.innerHTML =
            enrollments.map(item => {

                const program =
                    item.program || {};


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
                                justify-content:
                                    space-between;
                                gap:20px;
                            "
                        >

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        program.title ||
                                        "Training Program"
                                    )}
                                </h3>

                                <p
                                    style="
                                        color:#64748b;
                                        margin-top:6px;
                                    "
                                >
                                    Status:
                                    ${escapeHTML(
                                        item.status
                                    )}
                                </p>

                            </div>

                            <strong>
                                ${item.progress || 0}%
                            </strong>

                        </div>


                        <div
                            style="
                                height:8px;
                                background:#e2e8f0;
                                border-radius:10px;
                                margin-top:18px;
                                overflow:hidden;
                            "
                        >

                            <div
                                style="
                                    width:${item.progress || 0}%;
                                    height:100%;
                                    background:
                                        var(--primary);
                                "
                            ></div>

                        </div>


                        ${
                            item.status === "Completed"
                            ? `
                                <p
                                    style="
                                        color:#16a34a;
                                        margin-top:15px;
                                        font-weight:600;
                                    "
                                >
                                    ✓ Completed
                                </p>
                            `
                            : `
                                <div
                                    style="
                                        margin-top:18px;
                                    "
                                >

                                    <label>
                                        Update Progress
                                    </label>

                                    <div
                                        style="
                                            display:flex;
                                            gap:10px;
                                            margin-top:8px;
                                        "
                                    >

                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            aria-label="Your progress in percent"
                                            value="${
                                                item.progress || 0
                                            }"
                                            id="progress-${
                                                item.enrollment_id
                                            }"
                                            style="
                                                width:100px;
                                            "
                                        >

                                        <button
                                            class="btn btn-primary"
                                            onclick="
                                                updateProgress(
                                                    '${escapeHTML(
                                                        item.enrollment_id
                                                    )}'
                                                )
                                            "
                                        >
                                            Update
                                        </button>

                                    </div>

                                </div>
                            `
                        }

                    </div>

                `;

            }).join("");


    } catch (error) {

        console.error(
            "Load enrollments error:",
            error
        );

        container.innerHTML = `
            <div class="card">
                Unable to load your training.
            </div>
        `;

    }

}


async function updateProgress(enrollmentId) {

    const input =
        document.getElementById(
            `progress-${enrollmentId}`
        );


    const progress =
        Number(input.value);


    try {

        const response =
            await fetch(
                `/api/enrollments/${
                    encodeURIComponent(
                        enrollmentId
                    )
                }/progress`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        progress
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to update progress"
            );

        }


        // Completion (100%) and the certificate are set by the trainer.


        loadEnrollments();


    } catch (error) {

        alert(
            error.message ||
            "Unable to update progress"
        );

    }

}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadPrograms();

        loadEnrollments();

    }
);