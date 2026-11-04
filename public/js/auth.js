const API_BASE = "/api/auth";

function showMessage(message, type = "error") {
    const messageBox = document.getElementById("message");

    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `alert alert-${type}`;
    messageBox.style.display = "block";
}

// Same rule as the server (utils/password.js)
function passwordProblem(password) {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain at least one letter and one number.";
    }
    return null;
}

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    let data = {};
    try { data = await response.json(); } catch { /* non-JSON */ }

    return { ok: response.ok, status: response.status, data };
}

// =========================
// REGISTER
// =========================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        // Basic validation
        if (!name || !email || !password || !confirmPassword) {
            showMessage("Please fill in all fields.");
            return;
        }

        const problem = passwordProblem(password);
        if (problem) {
            showMessage(problem);
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.");
            return;
        }

        const submitButton = registerForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Creating Account...";

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.message || "Registration failed.");
                return;
            }

            showMessage(
                data.message ||
                    "Account created successfully. Please verify your email.",
                "success"
            );

            registerForm.reset();

            // Go to email verification page after short delay
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 1500);

        } catch (error) {
            console.error("Registration error:", error);

            showMessage(
                "Unable to connect to the server. Please try again."
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Create Account";
        }
    });
}


// =========================
// LOGIN
// =========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showMessage("Please enter your email and password.");
            return;
        }

        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Logging in...";

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.message || "Login failed.");

                if (data.code === "EMAIL_NOT_VERIFIED") {
                    offerResendVerification(email);
                }
                return;
            }

            // The real login token is in an HttpOnly cookie the browser keeps
            // (scripts cannot read it). localStorage only remembers that
            // this browser is signed in, for page redirects.
            localStorage.setItem("nexcraft_token", "cookie-session");

            // Return to the page the user was on before the session expired
            const next = new URLSearchParams(location.search).get("next");

            if (next && next.startsWith("/") && !next.startsWith("//")) {
                window.location.href = next;

            } else if (data.user && data.user.active_role) {
                const role = data.user.active_role.toLowerCase();
                window.location.href = `/${role}/dashboard.html`;

            } else {

                window.location.href =
                    "/role-selection.html";
            }

        } catch (error) {
            console.error("Login error:", error);

            showMessage(
                "Unable to connect to the server. Please try again."
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Login";
        }
    });
}


// =========================
// LOGIN PAGE EXTRAS
// =========================

// Every logout ends on this page, so clear the session cookie here too.
// This covers older pages that only clear localStorage before redirecting.
if (loginForm) {
    localStorage.removeItem("nexcraft_token");
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

if (loginForm && new URLSearchParams(location.search).get("expired")) {
    showMessage("Your session has expired. Please log in again.", "error");
}

function offerResendVerification(email) {
    const box = document.getElementById("message");
    if (!box || box.querySelector("button")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline";
    button.style.marginTop = "10px";
    button.textContent = "Resend verification email";

    button.addEventListener("click", async () => {
        button.disabled = true;
        const result = await postJSON("/api/auth/resend-verification", { email });
        showMessage(result.data.message || "If needed, a new link has been sent.", "success");
    });

    box.appendChild(document.createElement("br"));
    box.appendChild(button);
}


// =========================
// FORGOT PASSWORD  (FR-03)
// =========================

const forgotForm = document.getElementById("forgotPasswordForm");

if (forgotForm) {
    forgotForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document.getElementById("forgotEmail").value.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage("Please enter a valid email address.");
            return;
        }

        const button = forgotForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const result = await postJSON("/api/auth/forgot-password", { email });

            showMessage(
                result.data.message || "Unable to send reset link.",
                result.ok ? "success" : "error"
            );

            if (result.ok) forgotForm.reset();

        } catch {
            showMessage("Unable to connect to the server. Please try again.");
        } finally {
            button.disabled = false;
            button.textContent = "Send Reset Link";
        }
    });
}


// =========================
// RESET PASSWORD  (FR-03)
// =========================

const resetForm = document.getElementById("resetPasswordForm");

if (resetForm) {
    const resetToken = new URLSearchParams(location.search).get("token");

    if (!resetToken) {
        showMessage("This reset link is incomplete. Please request a new one from the Forgot Password page.");
        resetForm.querySelector("button").disabled = true;
    }

    resetForm.addEventListener("submit", async event => {
        event.preventDefault();

        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const problem = passwordProblem(newPassword);
        if (problem) {
            showMessage(problem);
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage("Passwords do not match.");
            return;
        }

        const button = resetForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Saving...";

        try {
            const result = await postJSON("/api/auth/reset-password", {
                token: resetToken,
                newPassword
            });

            if (!result.ok) {
                showMessage(result.data.message || "Password reset failed.");
                return;
            }

            showMessage((result.data.message || "Password updated.") + " Redirecting to login…", "success");
            setTimeout(() => { window.location.href = "/login.html"; }, 2000);

        } catch {
            showMessage("Unable to connect to the server. Please try again.");
        } finally {
            button.disabled = false;
            button.textContent = "Reset Password";
        }
    });
}


// =========================
// VERIFY EMAIL  (FR-01)
// =========================

if (document.getElementById("verifyContinue")) {
    (async () => {
        const token = new URLSearchParams(location.search).get("token");

        if (!token) {
            showMessage("This verification link is incomplete. Please use the link from your email.");
            return;
        }

        try {
            const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
            let data = {};
            try { data = await response.json(); } catch { /* non-JSON */ }

            showMessage(
                data.message || (response.ok ? "Email verified." : "Verification failed."),
                response.ok ? "success" : "error"
            );

        } catch {
            showMessage("Unable to connect to the server. Please try again.");
        }

        document.getElementById("verifyContinue").hidden = false;
    })();
}
