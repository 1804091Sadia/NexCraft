const token = localStorage.getItem("nexcraft_token");

if (!token) {
    window.location.href = "/login.html";
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(message, type = "error") {
    const messageBox = document.getElementById("message");

    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `alert alert-${type}`;
    messageBox.style.display = "block";
}


// ================================
// LOAD USER
// ================================
async function loadUser() {
    try {
        const response = await fetch("/api/auth/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            localStorage.removeItem("nexcraft_token");
            window.location.href = "/login.html";
            return null;
        }

        const user = data.user;

        const roles = Array.isArray(user.roles)
            ? user.roles
            : user.active_role
                ? [user.active_role]
                : [];
        const hasTrainerRole = roles.some(
            role => typeof role === "string" && role.toLowerCase() === "trainer"
        );

        if (hasTrainerRole) {
            const dashboardTitle = document.getElementById("dashboardTitle");
            if (dashboardTitle) {
                dashboardTitle.textContent = "Learner + Trainer Dashboard";
            }

            document.title = "Learner + Trainer Dashboard | NexCraft";

            const roleBadges = document.getElementById("accountRoleBadges");
            if (roleBadges) {
                const learnerBadge = document.getElementById("learnerRoleBadge");
                if (learnerBadge) learnerBadge.remove();

                const trainerBadge = document.createElement("span");
                trainerBadge.textContent = "Trainer";
                trainerBadge.style.cssText = "background:#ecfdf5;color:#047857;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:600;";
                roleBadges.appendChild(trainerBadge);
            }

            const trainerSidebarLinks = document.getElementById("trainerSidebarLinks");
            if (trainerSidebarLinks) trainerSidebarLinks.style.display = "block";

            const menuTitle = document.getElementById("sidebarMenuTitle");
            if (menuTitle) menuTitle.textContent = "Learner + Trainer Menu";

            const description = document.getElementById("dashboardDescription");
            if (description) {
                description.textContent = "Manage your training programs and support learners.";
            }
        }

        // Welcome name
        const userName = document.getElementById("userName");

        if (userName) {
            userName.textContent = user.name || "Learner";
        }

        // Profile card name
        const profileName = document.getElementById("profileName");

        if (profileName) {
            profileName.textContent = user.name || "Learner";
        }

        // Profile card email
        const profileEmail = document.getElementById("profileEmail");

        if (profileEmail) {
            profileEmail.textContent = user.email || "";
        }

        // Profile initial
        const profileInitial = document.getElementById("profileInitial");

        if (profileInitial) {
            profileInitial.textContent =
                user.name
                    ? user.name.charAt(0).toUpperCase()
                    : "L";
        }

        return user;

    } catch (error) {
        console.error("Load user error:", error);
    }

    return null;
}


// ================================
// LOAD LEARNER PROFILE
// ================================
async function loadLearnerProfile() {
    try {
        const response = await fetch("/api/learners/profile", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {

            // Profile does not exist yet
            if (response.status === 404) {
                return;
            }

            throw new Error(
                data.message || "Failed to load learner profile"
            );
        }

        const profile = data.profile;

        


        // -------------------------------
        // Profile image
        // -------------------------------
        const profileImage =
            document.getElementById("dashboardProfileImage");

        if (profileImage && profile.profile_image) {

            profileImage.innerHTML = `
                <img
                    src="${escapeHTML(profile.profile_image)}"
                    alt="Profile Photo"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >
            `;
        }


        // -------------------------------
        // Profile completeness
        // -------------------------------
        const completeness =
            document.getElementById("profileCompleteness");

        if (completeness) {
            completeness.textContent =
                `${profile.profile_completed || 0}%`;
        }

        // Skills count
        const skillCount =
            document.getElementById("skillCount");

        if (skillCount) {
            skillCount.textContent =
                Array.isArray(profile.skills)
                    ? profile.skills.length
                    : 0;
        }

        // -------------------------------
        // LOAD SKILLS
        // -------------------------------
        loadDashboardSkills(profile.skills);

    } catch (error) {

        console.error(
            "Load learner profile error:",
            error
        );
    }
}


// ================================
// DISPLAY SKILLS ON DASHBOARD
// ================================
function loadDashboardSkills(skills) {

    const skillsContainer =
        document.getElementById("dashboardSkills");

    if (!skillsContainer) {
        return;
    }

    // No skills
    if (!Array.isArray(skills) || skills.length === 0) {

        skillsContainer.innerHTML = `
            <p class="empty-state">
                No skills added yet.
            </p>
        `;

        return;
    }


    // Show maximum 6 skills on dashboard
    const visibleSkills = skills.slice(0, 6);

    skillsContainer.innerHTML = visibleSkills
        .map(skill => `
            <span class="skill-tag">
                ${escapeHTML(skill)}
            </span>
        `)
        .join("");


    // If more than 6 skills
    if (skills.length > 6) {

        skillsContainer.innerHTML += `
            <a
                href="/learner/skills.html"
                class="more-skills"
            >
                +${skills.length - 6} more
            </a>
        `;
    }
}


// ================================
// LOAD APPLICATIONS
// ================================
async function loadDashboardApplications() {

    try {

        const response = await fetch(
            "/api/applications",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to load applications"
            );
        }

        const applications =
            data.applications || [];


        // -------------------------------
        // Application count
        // -------------------------------
        const applicationCount =
            document.getElementById("applicationCount");

        if (applicationCount) {
            applicationCount.textContent =
                applications.length;
        }


        // -------------------------------
        // Recent applications
        // -------------------------------
        const container =
            document.getElementById(
                "recentApplications"
            );

        if (!container) {
            return;
        }


        if (applications.length === 0) {

            container.innerHTML = `
                <div class="empty-state">
                    <p>No applications yet.</p>

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


        const recentApplications =
            applications.slice(0, 3);


        container.innerHTML =
            recentApplications
                .map(application => {

                    const job =
                        application.job || {};

                    return `
                        <div class="application-item">

                            <div>
                                <h4>
                                    ${escapeHTML(
                                        job.title ||
                                        "Job Application"
                                    )}
                                </h4>

                                <p>
                                    ${escapeHTML(
                                        job.company ||
                                        "Company"
                                    )}
                                </p>
                            </div>

                            <div>
                                <span class="status">
                                    ${escapeHTML(
                                        application.status ||
                                        "Applied"
                                    )}
                                </span>
                            </div>

                        </div>
                    `;
                })
                .join("");

    } catch (error) {

        console.error(
            "Load dashboard applications error:",
            error
        );
    }
}


// ================================
// PAGE LOAD
// ================================
document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadUser();

        await loadLearnerProfile();

        await loadDashboardApplications();

        // Graduate showcase is initialised by /js/showcase.js
        // (it fills #graduateShowcase automatically).
    }
);

