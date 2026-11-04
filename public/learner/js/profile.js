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


// Show message
function showMessage(message, type = "error") {

    const messageBox = document.getElementById("message");

    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.style.display = "block";

    messageBox.className = `alert ${type}`;
}


// Set value
function setValue(id, value) {

    const element = document.getElementById(id);

    if (!element) return;

    if (value === null || value === undefined || value === "") {

        element.textContent = "Not provided";
        element.classList.add("empty-value");

    } else {

        element.textContent = value;
        element.classList.remove("empty-value");
    }
}


// Load user
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

            return;
        }


        const user = data.user;

        document.getElementById("userName").textContent =
            user.name || "Learner";

        document.getElementById("userEmail").textContent =
            user.email || "";


        // Initial
        const initial = user.name
            ? user.name.charAt(0).toUpperCase()
            : "L";

        const profileInitial =
            document.getElementById("profileInitial");

        if (profileInitial) {
            profileInitial.textContent = initial;
        }

    } catch (error) {

        console.error("User loading error:", error);

        showMessage("Unable to load user information.");
    }
}


// Load learner profile
async function loadProfile() {

    try {

        const response = await fetch("/api/learners/profile", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();


        if (!response.ok) {

            if (response.status === 404) {

                showMessage(
                    "Your learner profile has not been created yet.",
                    "warning"
                );

                return;
            }

            throw new Error(
                data.message || "Failed to load profile"
            );
        }


        const profile = data.profile;


        // Basic information
        setValue("phone", profile.phone);
        setValue("location", profile.location);
        setValue("education", profile.education);
        setValue("career", profile.career);
        setValue("track", profile.track);
        setValue("employment_status", profile.employment_status);
        setValue("experience_level", profile.experience_level);
        setValue("bio", profile.bio);


        // Skills
        const skillsContainer =
            document.getElementById("skills");

        if (
            Array.isArray(profile.skills) &&
            profile.skills.length > 0
        ) {

            skillsContainer.innerHTML =
                profile.skills
                    .map(skill => `
                        <span class="skill-tag">
                            ${escapeHTML(skill)}
                        </span>
                    `)
                    .join("");

        } else {

            skillsContainer.innerHTML = `
                <span class="empty-value">
                    No skills added
                </span>
            `;
        }


        // Profile completeness
        const completeness =
            Number(profile.profile_completed || 0);

        document.getElementById("completionText")
            .textContent = `${completeness}%`;

        document.getElementById("completionBar")
            .style.width = `${completeness}%`;


        // Profile image
        const imageContainer =
            document.getElementById("profileImage");

        if (profile.profile_image) {

            imageContainer.innerHTML = `
                <img
                    src="${escapeHTML(profile.profile_image)}"
                    alt="Profile photo"
                >
            `;

        } else {

            imageContainer.innerHTML = `
                <span id="profileInitial">
                    L
                </span>
            `;
        }


        // CV
        const cvContainer =
            document.getElementById("currentCV");

        if (profile.cv) {

            cvContainer.innerHTML = `
                <a
                    href="#"
                data-cv="me"
                    class="cv-link">
                    View CV
                </a>
            `;

        } else {

            cvContainer.innerHTML = `
                <span class="empty-value">
                    No CV uploaded
                </span>
            `;
        }


        // Check Trainer conversion status
        handleTrainerConversionState(profile);

    } catch (error) {

        console.error("Profile loading error:", error);

        showMessage(
            "Unable to load your profile information."
        );
    }
}


// Handle Trainer conversion state
function handleTrainerConversionState(profile) {

    const form =
        document.getElementById("trainerConversionForm");

    const convertedMessage =
        document.getElementById("trainerConvertedMessage");

    if (!form || !convertedMessage) return;


    /*
     * The backend changes learner profile status to:
     * "Converted to Trainer"
     */
    if (
        profile.status &&
        profile.status.toLowerCase() ===
        "converted to trainer".toLowerCase()
    ) {

        form.style.display = "none";
        convertedMessage.style.display = "block";

        return;
    }


    form.style.display = "block";
    convertedMessage.style.display = "none";
}


// Show Trainer conversion message
function showTrainerConversionMessage(
    message,
    type = "error"
) {

    const messageBox =
        document.getElementById(
            "trainerConversionMessage"
        );

    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.style.display = "block";

    messageBox.className =
        `alert trainer-message ${type}`;
}


// Convert Learner to Trainer
async function becomeTrainer() {

    const expertiseInput =
        document.getElementById("trainerExpertise");

    const bioInput =
        document.getElementById("trainerBio");

    const button =
        document.getElementById("becomeTrainerBtn");


    if (!expertiseInput || !bioInput || !button) {
        return;
    }


    const expertise_area =
        expertiseInput.value.trim();

    const bio =
        bioInput.value.trim();


    // Validation
    if (!expertise_area) {

        showTrainerConversionMessage(
            "Please enter your expertise area.",
            "error"
        );

        expertiseInput.focus();

        return;
    }


    if (!bio) {

        showTrainerConversionMessage(
            "Please enter your trainer bio.",
            "error"
        );

        bioInput.focus();

        return;
    }


    // Confirmation
    const confirmed = confirm(
        "Submit your Trainer application for admin approval?"
    );

    if (!confirmed) {
        return;
    }


    try {

        button.disabled = true;
        button.textContent = "Submitting...";


        const response = await fetch(
            "/api/trainer-conversion/convert",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    expertise_area,
                    bio
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to submit your Trainer application."
            );
        }


        showTrainerConversionMessage(
            data.message ||
            "Your Trainer application was submitted for admin approval.",
            "success"
        );


        // Hide conversion form
        document.getElementById(
            "trainerConversionForm"
        ).style.display = "none";


        // Show success area
        document.getElementById(
            "trainerConvertedMessage"
        ).style.display = "block";


    } catch (error) {

        console.error(
            "Trainer conversion error:",
            error
        );

        showTrainerConversionMessage(
            error.message ||
            "Trainer application failed.",
            "error"
        );

        button.disabled = false;
        button.textContent = "Submit Trainer Application";
    }
}


// Initial load
document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadUser();

        await loadProfile();


        // Trainer conversion button
        const becomeTrainerButton =
            document.getElementById(
                "becomeTrainerBtn"
            );

        if (becomeTrainerButton) {

            becomeTrainerButton.addEventListener(
                "click",
                becomeTrainer
            );
        }

    }
);