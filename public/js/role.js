let selectedRole = null;


// ===============================
// SELECT ROLE
// ===============================

function selectRole(card) {

    // Remove selection from all cards
    document.querySelectorAll(".role-card").forEach((item) => {
        item.classList.remove("selected");
    });

    // Select clicked card
    card.classList.add("selected");

    // Save selected role
    selectedRole = card.dataset.role;

    // Enable continue button
    const continueButton =
        document.getElementById("continueButton");

    continueButton.disabled = false;
}


// ===============================
// CONTINUE WITH ROLE
// ===============================

async function continueWithRole() {

    if (!selectedRole) {
        showRoleMessage(
            "Please select a role first.",
            "error"
        );

        return;
    }

    const token =
        localStorage.getItem("nexcraft_token");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    const button =
        document.getElementById("continueButton");

    const accountRole = selectedRole;

    button.disabled = true;
    button.textContent = "Saving...";

    try {

        const response = await fetch(
            "/api/roles/select",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    role: accountRole
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {

            showRoleMessage(
                data.message || "Unable to select role.",
                "error"
            );

            button.disabled = false;
            button.textContent = "Continue";

            return;
        }


        // Save selected role locally
        localStorage.setItem(
            "nexcraft_role",
            accountRole
        );


        // Go to profile creation
        if (accountRole === "Learner") {

            window.location.href =
                "/learner/edit-profile.html";

        } else if (accountRole === "Employer") {

            window.location.href =
                "/employer/profile.html";

        } else if (accountRole === "Trainer") {

            window.location.href =
                "/trainer/dashboard.html";
        }

    } catch (error) {

        console.error(
            "Role selection error:",
            error
        );

        showRoleMessage(
            "Unable to connect to the server.",
            "error"
        );

        button.disabled = false;
        button.textContent = "Continue";
    }
}


// ===============================
// MESSAGE
// ===============================

function showRoleMessage(message, type = "error") {

    const messageBox =
        document.getElementById("message");

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className =
        `alert alert-${type}`;

    messageBox.style.display = "block";
}