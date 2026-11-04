/* =========================================================
   NEXCRAFT - COMMON FRONTEND FUNCTIONS
   Load this file on every page BEFORE page-specific scripts.
   ========================================================= */

const TOKEN_KEY = "nexcraft_token";


/* ---------------------------------------------------------
   Session helpers
--------------------------------------------------------- */

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function isLoggedIn() {
    return !!getToken();
}

function logoutUser() {
    localStorage.removeItem(TOKEN_KEY);

    // Clear the HttpOnly session cookie on the server, then leave
    fetch("/api/auth/logout", { method: "POST", keepalive: true })
        .catch(() => {})
        .finally(() => { window.location.href = "/login.html"; });
}

function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href =
            "/login.html?next=" + encodeURIComponent(location.pathname + location.search);
    }
}

function goHome() {
    window.location.href = "/index.html";
}

function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = "/index.html";
    }
}


/* ---------------------------------------------------------
   escapeHTML — use for EVERY value put into innerHTML.
   (One shared copy; page scripts had 16 duplicates.)
--------------------------------------------------------- */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/* ---------------------------------------------------------
   apiFetch — one place for token, JSON and error handling.

   Usage:
       const data = await apiFetch("/api/jobs");
       await apiFetch("/api/saved-jobs", { method: "POST", body: { job_id } });

   - Adds the Bearer token automatically
   - Sends plain objects as JSON (FormData is sent as-is)
   - On 401 (expired/invalid session) -> redirects to login
   - Throws Error(message) with a human-readable message otherwise
--------------------------------------------------------- */

async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let body = options.body;

    if (body && !(body instanceof FormData) && typeof body !== "string") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }

    let response;

    try {
        response = await fetch(url, { ...options, headers, body });
    } catch (networkError) {
        throw new Error("Cannot reach the server. Check your connection and try again.");
    }

    let data = null;

    try {
        data = await response.json();
    } catch {
        // Server returned HTML or nothing (e.g. route missing)
        data = null;
    }

    if (response.status === 401 && token) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href =
            "/login.html?expired=1&next=" + encodeURIComponent(location.pathname);
        throw new Error("Session expired");
    }

    if (!response.ok) {
        throw new Error(
            (data && data.message) ||
            `Something went wrong (error ${response.status}). Please try again.`
        );
    }

    return data || {};
}


/* ---------------------------------------------------------
   openCv — CVs are private (FR-41). They are fetched with the
   login token and opened as a temporary blob URL.
   Any element with data-cv="<user_id>" or data-cv="me" opens one.
--------------------------------------------------------- */

async function openCv(userId = "me") {
    // Open the tab first (synchronously) so pop-up blockers allow it
    const tab = window.open("", "_blank");

    try {
        const response = await fetch(`/api/files/cv/${encodeURIComponent(userId)}`, {
            headers: { Authorization: `Bearer ${getToken()}` }
        });

        if (!response.ok) {
            let message = "Unable to open the CV.";
            try { message = (await response.json()).message || message; } catch { /* ignore */ }
            throw new Error(message);
        }

        const url = URL.createObjectURL(await response.blob());

        if (tab) tab.location.href = url;
        else window.location.href = url;

        setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);

    } catch (error) {
        if (tab) tab.close();
        alert(error.message);
    }
}

document.addEventListener("click", event => {
    const link = event.target.closest("[data-cv]");
    if (!link) return;
    event.preventDefault();
    openCv(link.dataset.cv || "me");
});


/* ---------------------------------------------------------
   Mobile Menu
--------------------------------------------------------- */

function setupMobileMenu() {

    const menuButton = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (!menuButton || !navLinks) {
        return;
    }

    menuButton.setAttribute("aria-expanded", "false");

    menuButton.addEventListener("click", () => {

        const open = navLinks.style.display === "flex";

        if (open) {
            navLinks.style.display = "";
        } else {
            navLinks.style.display = "flex";
            navLinks.style.flexDirection = "column";
            navLinks.style.position = "absolute";
            navLinks.style.top = "72px";
            navLinks.style.left = "0";
            navLinks.style.right = "0";
            navLinks.style.padding = "15px";
            navLinks.style.background = "white";
            navLinks.style.borderBottom = "1px solid #e2e8f0";
            navLinks.style.zIndex = "40";
        }

        menuButton.setAttribute("aria-expanded", String(!open));
    });
}


/* ---------------------------------------------------------
   Notification bell (FR-35 / FR-44)
   Mounts automatically into .nav-actions on logged-in pages.
--------------------------------------------------------- */

function timeAgo(dateValue) {
    const seconds = Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return new Date(dateValue).toLocaleDateString();
}

function setupNotificationBell() {
    const actions = document.querySelector(".nav-actions");
    const isAppPage = /^\/(learner|employer|admin)\/|^\/(messages|notifications|settings)\.html/.test(location.pathname);

    if (!actions || !isLoggedIn() || !isAppPage) {
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "notif-wrap";
    wrap.innerHTML = `
        <button type="button" class="notif-button" aria-label="Notifications" aria-expanded="false">
            🔔<span class="notif-count" hidden></span>
        </button>
        <div class="notif-panel" hidden>
            <div class="notif-panel-head">
                <span>Notifications</span>
                <button type="button" data-read-all>Mark all read</button>
            </div>
            <div class="notif-list"><div class="notif-empty">Loading…</div></div>
            <a class="notif-item" href="/notifications.html" style="text-align:center;font-weight:600;color:var(--primary);">See all notifications</a>
        </div>
    `;
    actions.prepend(wrap);

    const button = wrap.querySelector(".notif-button");
    const count = wrap.querySelector(".notif-count");
    const panel = wrap.querySelector(".notif-panel");
    const list = wrap.querySelector(".notif-list");

    async function load() {
        try {
            const data = await apiFetch("/api/notifications?limit=15");

            count.hidden = !data.unreadCount;
            count.textContent = data.unreadCount > 9 ? "9+" : data.unreadCount;

            list.innerHTML = data.notifications.length
                ? data.notifications.map(n => `
                    <a class="notif-item ${n.is_read ? "" : "unread"}"
                       href="${escapeHTML(n.link || "#")}"
                       data-id="${escapeHTML(n.notification_id)}">
                        <strong>${escapeHTML(n.title)}</strong>
                        <span>${escapeHTML(n.body)}</span>
                        <time>${escapeHTML(timeAgo(n.created_at))}</time>
                    </a>`).join("")
                : `<div class="notif-empty">You're all caught up.</div>`;
        } catch (error) {
            list.innerHTML = `<div class="notif-empty">${escapeHTML(error.message)}</div>`;
        }
    }

    button.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) load();
    });

    document.addEventListener("click", event => {
        if (!wrap.contains(event.target)) {
            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
        }
    });

    list.addEventListener("click", event => {
        const item = event.target.closest(".notif-item");
        if (item && item.classList.contains("unread")) {
            // Fire-and-forget; navigation continues
            apiFetch(`/api/notifications/${encodeURIComponent(item.dataset.id)}/read`, { method: "PATCH" })
                .catch(() => {});
        }
    });

    wrap.querySelector("[data-read-all]").addEventListener("click", async () => {
        await apiFetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
        load();
    });

    load();
    setInterval(load, 60 * 1000); // light polling; real-time is out of scope (spec 2.2)
}


/* ---------------------------------------------------------
   Initialize
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    setupMobileMenu();
    setupNotificationBell();

    // Shown once after "Delete my account"
    if (new URLSearchParams(location.search).get("deleted") === "1") {
        const note = document.createElement("div");
        note.className = "alert alert-success";
        note.setAttribute("role", "status");
        note.style.cssText = "display:block;max-width:900px;margin:16px auto;";
        note.textContent = "Your account and personal data have been deleted.";
        (document.querySelector("main") || document.body).prepend(note);
    }
});
