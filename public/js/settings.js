// Settings: name, password (FR-36), portal switch
const nameForm = document.getElementById("nameForm");
const passwordForm = document.getElementById("passwordForm");

const DASHBOARDS = {
    Learner: "/learner/dashboard.html",
    Trainer: "/trainer/dashboard.html",
    Employer: "/employer/dashboard.html",
    Admin: "/admin/dashboard.html"
};

function passwordProblem(password) {
    if (password.length < 8) return "New password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "New password must contain at least one letter and one number.";
    }
    return null;
}

initPage().then(user => {
    document.getElementById("fullName").value = user.name || "";
    document.getElementById("emailAddress").value = user.email || "";

    const roles = user.roles || [];

    if (roles.includes("Learner") && roles.includes("Trainer")) {
        document.getElementById("portalPanel").hidden = false;

        document.getElementById("portalButtons").innerHTML = ["Learner", "Trainer"].map(role => `
            <button type="button" class="btn ${user.active_role === role ? "btn-primary" : "btn-outline"}"
                data-portal="${role}" ${user.active_role === role ? 'aria-pressed="true"' : ""}>
                ${role} portal${user.active_role === role ? " (current)" : ""}
            </button>`).join("");

        document.getElementById("portalButtons").addEventListener("click", event => {
            const button = event.target.closest("[data-portal]");
            if (!button || button.getAttribute("aria-pressed") === "true") return;

            withBusy(button, "Switching…", async () => {
                await apiFetch("/api/roles/active", { method: "PATCH", body: { active_role: button.dataset.portal } });
                window.location.href = DASHBOARDS[button.dataset.portal];
            }).catch(error => flash(error.message));
        });
    }
}).catch(() => {});

nameForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("fullName").value.trim();

    try {
        await withBusy(nameForm.querySelector("button"), "Saving…", () =>
            apiFetch("/api/auth/me", { method: "PATCH", body: { name } }));
        document.getElementById("navUser").textContent = name;
        flash("Name updated.", "success");
    } catch (error) {
        flash(error.message);
    }
});

passwordForm.addEventListener("submit", async event => {
    event.preventDefault();

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!currentPassword) return flash("Enter your current password.");
    const problem = passwordProblem(newPassword);
    if (problem) return flash(problem);
    if (newPassword !== confirmPassword) return flash("New passwords do not match.");

    try {
        await withBusy(passwordForm.querySelector("button"), "Changing…", () =>
            apiFetch("/api/auth/change-password", {
                method: "POST",
                body: { currentPassword, newPassword }
            }));
        passwordForm.reset();
        flash("Password changed. Other devices are signed out.", "success");
    } catch (error) {
        flash(error.message);
    }
});


// Delete account (Apple 5.1.1(v), Google Play account-deletion policy)
document.getElementById("deleteAccount").addEventListener("click", () => {
    openModal({
        title: "Delete your account?",
        confirmText: "Delete permanently",
        danger: true,
        body: `
            <p style="margin-bottom:14px;">Your profile, CV, applications, enrollments and certificates
            will be deleted. <strong>This cannot be undone.</strong></p>
            <div class="form-group">
                <label for="deletePassword" class="required">Your password</label>
                <input id="deletePassword" type="password" class="form-control" autocomplete="current-password">
            </div>
            <div class="form-group">
                <label for="deleteConfirm" class="required">Type DELETE to confirm</label>
                <input id="deleteConfirm" class="form-control" autocomplete="off" autocapitalize="characters">
            </div>`,
        onConfirm: async dialog => {
            const password = dialog.querySelector("#deletePassword").value;
            const confirm = dialog.querySelector("#deleteConfirm").value.trim();
            if (!password) throw new Error("Enter your password.");
            if (confirm !== "DELETE") throw new Error("Type DELETE in capital letters to confirm.");

            await apiFetch("/api/auth/me", { method: "DELETE", body: { password, confirm } });

            localStorage.removeItem("nexcraft_token");
            window.location.href = "/index.html?deleted=1";
        }
    });
});
