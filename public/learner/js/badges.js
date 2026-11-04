const token = localStorage.getItem("nexcraft_token");

if (!token) {
    window.location.href = "/login.html";
}

const badgesContainer = document.getElementById("badgesContainer");


function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


function formatDate(date) {

    if (!date) {
        return "Not specified";
    }

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "Not specified";
    }

    return d.toLocaleDateString();
}


async function loadBadges() {

    try {

        const response = await fetch(
            "/api/badges/my",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.message || "Unable to load badges"
            );

        }


        const badges = data.badges || [];


        if (badges.length === 0) {

            badgesContainer.innerHTML = `
                <div style="
                    text-align:center;
                    padding:40px;
                ">

                    <h3>No badges earned yet</h3>

                    <p style="
                        color:#64748b;
                        margin-top:10px;
                    ">
                        Complete eligible training or activities
                        to earn badges.
                    </p>

                </div>
            `;

            return;
        }


        badgesContainer.innerHTML = `

            <div style="
                display:grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                gap:20px;
            ">

                ${badges.map(badge => `

                    <div class="card"
                         style="
                            padding:25px;
                            text-align:center;
                         ">

                        <div style="
                            width:70px;
                            height:70px;
                            margin:0 auto 15px;
                            border-radius:50%;
                            background:#eef2ff;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:30px;
                        ">
                            🏆
                        </div>

                        <h3>
                            ${escapeHTML(
                                badge.name ||
                                badge.title ||
                                "Badge"
                            )}
                        </h3>

                        <p style="
                            color:#64748b;
                            margin-top:10px;
                        ">
                            ${escapeHTML(
                                badge.description ||
                                "Achievement badge"
                            )}
                        </p>

                        <p style="
                            margin-top:15px;
                            font-size:13px;
                            color:#64748b;
                        ">
                            Earned:
                            ${formatDate(
                                badge.earned_at ||
                                badge.created_at
                            )}
                        </p>

                    </div>

                `).join("")}

            </div>
        `;

    } catch (error) {

        console.error(
            "Load badges error:",
            error
        );


        badgesContainer.innerHTML = `

            <div style="
                text-align:center;
                padding:40px;
            ">

                <h3>Unable to load badges</h3>

                <p style="
                    color:#64748b;
                    margin-top:10px;
                ">
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;
    }
}


loadBadges();