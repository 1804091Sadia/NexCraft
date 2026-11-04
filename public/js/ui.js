/* =========================================================
   NEXCRAFT - SHARED PAGE SHELL & UI HELPERS
   Used by learner, employer, admin and messages pages.
   Load after /js/common.js.

   A page declares its role and menu item on <body>:
       <body data-role="employer" data-page="jobs">
   and calls:
       initPage().then(user => { ...load data... });
   ========================================================= */

const SIDEBARS = {
    learner: {
        title: "Learner Menu",
        home: "/learner/dashboard.html",
        items: [
            ["dashboard", "▦", "Dashboard", "/learner/dashboard.html"],
            ["profile", "◯", "My Profile", "/learner/profile.html"],
            ["jobs", "💼", "Find Jobs", "/learner/jobs.html"],
            ["applications", "▤", "Applications", "/learner/applications.html"],
            ["saved-jobs", "🔖", "Saved Jobs", "/learner/saved-jobs.html"],
            ["training", "🎓", "Training", "/learner/training.html"],
            ["skills", "◆", "My Skills", "/learner/skills.html"],
            ["badges", "🏆", "Badges", "/learner/badges.html"],
            ["messages", "✉", "Messages", "/messages.html"],
            ["notifications", "🔔", "Notifications", "/notifications.html"],
            ["settings", "⚙", "Settings", "/settings.html"]
        ]
    },
    trainer: {
        title: "Trainer Menu",
        home: "/trainer/dashboard.html",
        items: [
            ["dashboard", "▦", "Dashboard", "/trainer/dashboard.html"],
            ["profile", "◯", "My Profile", "/trainer/profile.html"],
            ["programs", "▣", "My Programs", "/trainer/programs.html"],
            ["enrollments", "♙", "Enrollments", "/trainer/enrollments.html"],
            ["messages", "✉", "Messages", "/messages.html"],
            ["statistics", "▥", "Statistics", "/trainer/statistics.html"],
            ["notifications", "🔔", "Notifications", "/notifications.html"],
            ["settings", "⚙", "Settings", "/settings.html"]
        ]
    },
    employer: {
        title: "Employer Menu",
        home: "/employer/dashboard.html",
        items: [
            ["dashboard", "▦", "Dashboard", "/employer/dashboard.html"],
            ["jobs", "💼", "My Jobs", "/employer/jobs.html"],
            ["new-job", "＋", "Post a Job", "/employer/job-form.html"],
            ["applications", "▤", "Applicants", "/employer/applications.html"],
            ["candidates", "🔍", "Find Candidates", "/employer/candidates.html"],
            ["messages", "✉", "Messages", "/messages.html"],
            ["profile", "🏢", "Company Profile", "/employer/profile.html"],
            ["notifications", "🔔", "Notifications", "/notifications.html"],
            ["settings", "⚙", "Settings", "/settings.html"]
        ]
    },
    admin: {
        title: "Admin Menu",
        home: "/admin/dashboard.html",
        items: [
            ["dashboard", "▦", "Overview", "/admin/dashboard.html"],
            ["approvals", "✓", "Approvals", "/admin/approvals.html"],
            ["users", "👥", "Users", "/admin/users.html"],
            ["badges", "🏆", "Badges", "/admin/badges.html"],
            ["skills", "◆", "Skills Catalogue", "/admin/skills.html"],
            ["showcase", "🎓", "Graduate Showcase", "/admin/showcase.html"],
            ["logs", "☰", "Audit Logs", "/admin/logs.html"],
            ["messages", "✉", "Messages", "/messages.html"],
            ["notifications", "🔔", "Notifications", "/notifications.html"],
            ["settings", "⚙", "Settings", "/settings.html"]
        ]
    }
};

const ROLE_NAMES = { learner: "Learner", trainer: "Trainer", employer: "Employer", admin: "Admin" };

function renderSidebar(roleKey, pageKey) {
    const sidebar = document.getElementById("sidebar");
    const config = SIDEBARS[roleKey];
    if (!sidebar || !config) return;

    sidebar.setAttribute("aria-label", config.title);
    sidebar.innerHTML = `
        <div class="sidebar-title">${escapeHTML(config.title)}</div>
        ${config.items.map(([key, icon, label, href]) => `
            <a href="${href}" class="${key === pageKey ? "active" : ""}"
               ${key === pageKey ? 'aria-current="page"' : ""}>
                <span aria-hidden="true">${icon}</span> ${escapeHTML(label)}
            </a>`).join("")}
        <a href="#" data-logout><span aria-hidden="true">↪</span> Logout</a>`;

    sidebar.querySelector("[data-logout]").addEventListener("click", event => {
        event.preventDefault();
        logoutUser();
    });

    const logo = document.querySelector(".navbar .logo");
    if (logo) logo.setAttribute("href", config.home);
}

/**
 * Checks the session and the role, draws the sidebar, fills the header.
 * Resolves with the current user. Redirects when not allowed.
 * data-role="any" pages (messages) use the user's active role menu.
 */
async function initPage() {
    requireLogin();

    const body = document.body;
    const required = body.dataset.role;
    const page = body.dataset.page;

    const { user } = await apiFetch("/api/auth/me");
    const roles = user.roles || [];

    let menuRole = required;

    if (required === "any") {
        menuRole = String(user.active_role || roles[0] || "learner").toLowerCase();
    } else if (!roles.includes(ROLE_NAMES[required])) {
        // Wrong portal: send the user to their own dashboard
        const own = String(user.active_role || "").toLowerCase();
        window.location.href = SIDEBARS[own] ? SIDEBARS[own].home : "/role-selection.html";
        throw new Error("Redirecting");
    }

    renderSidebar(menuRole, page);

    const navUser = document.getElementById("navUser");
    if (navUser) navUser.textContent = user.name;

    return user;
}


/* ---------------------------------------------------------
   Small helpers
--------------------------------------------------------- */

const STATUS_TEXT = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    active: "Active",
    rejected: "Rejected",
    closed: "Closed",
    pending: "Pending",
    approved: "Approved",
    suspended: "Suspended"
};

function statusLabel(status) {
    return STATUS_TEXT[status] || status || "—";
}

// Coloured pill; colour chosen from the meaning, not the exact word
function statusPill(status) {
    const label = statusLabel(status);
    const key = String(label).toLowerCase();
    let tone = "neutral";

    if (/active|approved|placed|completed|shortlisted|showcased/.test(key)) tone = "good";
    else if (/pending|review|interview|outcome|received|in progress|draft/.test(key)) tone = "warn";
    else if (/reject|suspend|not progressed|withdrawn|closed|dropped|hidden/.test(key)) tone = "bad";

    return `<span class="pill pill-${tone}">${escapeHTML(label)}</span>`;
}

function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    return withTime
        ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// Salaries are monthly amounts in Bangladeshi Taka
const CURRENCY = "BDT";

function formatSalary(min, max) {
    const fmt = n => Number(n).toLocaleString("en-IN");
    if (min && max) return `${CURRENCY} ${fmt(min)} – ${fmt(max)} / month`;
    if (min) return `From ${CURRENCY} ${fmt(min)} / month`;
    if (max) return `Up to ${CURRENCY} ${fmt(max)} / month`;
    return "Salary not specified";
}

function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
        .map(part => part[0].toUpperCase()).join("");
}

function avatar(name, image, size = 40) {
    return image
        ? `<img class="avatar" src="${escapeHTML(image)}" alt="" style="width:${size}px;height:${size}px;">`
        : `<span class="avatar" aria-hidden="true" style="width:${size}px;height:${size}px;">${escapeHTML(initials(name))}</span>`;
}

// Page-level message box: <div id="message" class="alert" hidden></div>
function flash(message, type = "error") {
    const box = document.getElementById("message");
    if (!box) return alert(message);

    box.textContent = message;
    box.className = `alert alert-${type}`;
    box.hidden = false;
    box.style.display = "block";
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });

    if (type === "success") {
        clearTimeout(flash.timer);
        flash.timer = setTimeout(() => { box.hidden = true; box.style.display = "none"; }, 4000);
    }
}

function emptyState(title, text = "", actionHtml = "") {
    return `<div class="empty-state">
        <h3>${escapeHTML(title)}</h3>
        ${text ? `<p>${escapeHTML(text)}</p>` : ""}
        ${actionHtml}
    </div>`;
}

function loadingState(text = "Loading…") {
    return `<div class="empty-state" aria-busy="true"><p>${escapeHTML(text)}</p></div>`;
}

function debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

// Disable a button while an async action runs; restores its label after
async function withBusy(button, busyText, action) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    try {
        return await action();
    } finally {
        button.disabled = false;
        button.textContent = original;
    }
}


/* ---------------------------------------------------------
   Modal dialog
   openModal({ title, body (HTML), confirmText, danger, onConfirm })
   onConfirm(dialog) may throw Error(message) to keep it open.
--------------------------------------------------------- */

function openModal({ title, body, confirmText = "Confirm", danger = false, onConfirm, wide = false }) {
    closeModal();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <div class="modal-head">
                <h2 id="modalTitle">${escapeHTML(title)}</h2>
                <button type="button" class="modal-close" aria-label="Close">×</button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-error alert alert-error" hidden></div>
            ${onConfirm ? `
            <div class="modal-actions">
                <button type="button" class="btn btn-outline" data-cancel>Cancel</button>
                <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>
                    ${escapeHTML(confirmText)}
                </button>
            </div>` : ""}
        </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const dialog = overlay.querySelector(".modal");
    const errorBox = overlay.querySelector(".modal-error");

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });
    overlay.querySelector(".modal-close").addEventListener("click", closeModal);
    overlay.querySelector("[data-cancel]")?.addEventListener("click", closeModal);

    const confirmButton = overlay.querySelector("[data-confirm]");
    confirmButton?.addEventListener("click", async () => {
        errorBox.hidden = true;
        try {
            await withBusy(confirmButton, "Please wait…", () => onConfirm(dialog));
            closeModal();
        } catch (error) {
            errorBox.textContent = error.message;
            errorBox.hidden = false;
        }
    });

    document.addEventListener("keydown", modalEscape);

    const firstField = dialog.querySelector("input, textarea, select, [data-confirm]");
    if (firstField) firstField.focus();

    return dialog;
}

function modalEscape(event) {
    if (event.key === "Escape") closeModal();
}

function closeModal() {
    document.querySelector(".modal-overlay")?.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", modalEscape);
}

// Ask for a required reason (rejections, suspensions)
function askReason({ title, label, confirmText, onConfirm }) {
    openModal({
        title,
        confirmText,
        danger: true,
        body: `
            <div class="form-group">
                <label for="reasonInput">${escapeHTML(label)}</label>
                <textarea id="reasonInput" class="form-control" rows="4" maxlength="1000"
                    placeholder="This is shown to the person, so be specific and constructive."></textarea>
            </div>`,
        onConfirm: async dialog => {
            const reason = dialog.querySelector("#reasonInput").value.trim();
            if (!reason) throw new Error("Please enter a reason.");
            await onConfirm(reason);
        }
    });
}

// Compose a message to someone (FR-26 / FR-33)
function composeMessage({ toId, toName, contextType = "", contextId = "", contextLabel = "" }) {
    openModal({
        title: `Message ${toName}`,
        confirmText: "Send",
        body: `
            ${contextLabel ? `<p class="muted" style="margin-bottom:10px;">About: ${escapeHTML(contextLabel)}</p>` : ""}
            <div class="form-group">
                <label for="messageBody">Message</label>
                <textarea id="messageBody" class="form-control" rows="5" maxlength="2000"></textarea>
            </div>`,
        onConfirm: async dialog => {
            const body = dialog.querySelector("#messageBody").value.trim();
            if (!body) throw new Error("Please write a message.");
            await apiFetch("/api/messages", {
                method: "POST",
                body: { receiver_id: toId, body, context_type: contextType, context_id: contextId }
            });
            flash(`Message sent to ${toName}.`, "success");
        }
    });
}

// Tabs: <div class="tabs" data-tabs><button data-tab="a">…</button></div>
function setupTabs(container, onChange) {
    const buttons = [...container.querySelectorAll("[data-tab]")];
    container.setAttribute("role", "tablist");

    function select(key) {
        buttons.forEach(b => {
            const active = b.dataset.tab === key;
            b.classList.toggle("active", active);
            b.setAttribute("aria-selected", String(active));
        });
        onChange(key);
    }

    buttons.forEach(b => {
        b.setAttribute("role", "tab");
        b.type = "button";
        b.addEventListener("click", () => select(b.dataset.tab));
    });

    return select;
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.autoSidebar !== "true") return;

    const main = document.querySelector("main");
    if (!main) {
        console.error("Unable to initialize module navigation: page main content is missing.");
        return;
    }

    const layout = document.createElement("div");
    const sidebar = document.createElement("aside");
    layout.className = "dashboard-layout";
    sidebar.className = "sidebar";
    sidebar.id = "sidebar";
    layout.appendChild(sidebar);
    main.parentNode.insertBefore(layout, main);
    layout.appendChild(main);

    initPage().catch(error => {
        if (error.message !== "Redirecting") {
            console.error("Unable to initialize module navigation:", error);
        }
    });
});
