// Notifications page (FR-35, FR-44) — every role
const list = document.getElementById("notifList");
let filter = "all";

async function loadNotifications() {
    list.innerHTML = loadingState();

    try {
        const data = await apiFetch(`/api/notifications?limit=50${filter === "unread" ? "&unread=true" : ""}`);

        document.getElementById("markAll").disabled = data.unreadCount === 0;

        if (!data.notifications.length) {
            list.innerHTML = emptyState(filter === "unread" ? "No unread notifications" : "No notifications yet",
                "You'll be notified about applications, approvals, messages and badges.");
            return;
        }

        list.innerHTML = data.notifications.map(n => `
            <a class="notif-item ${n.is_read ? "" : "unread"}" href="${escapeHTML(n.link || "#")}"
               data-id="${escapeHTML(n.notification_id)}" style="padding:16px 20px;">
                <strong>${n.is_read ? "" : "● "}${escapeHTML(n.title)}</strong>
                <span>${escapeHTML(n.body)}</span>
                <time>${formatDate(n.created_at, true)}</time>
            </a>`).join("");

    } catch (error) {
        list.innerHTML = emptyState("Could not load notifications", error.message);
    }
}

list.addEventListener("click", event => {
    const item = event.target.closest("[data-id]");
    if (!item || !item.classList.contains("unread")) return;

    // Mark read, then follow the link (or stay if there is none)
    event.preventDefault();
    apiFetch(`/api/notifications/${encodeURIComponent(item.dataset.id)}/read`, { method: "PATCH" })
        .catch(() => {})
        .finally(() => {
            const href = item.getAttribute("href");
            if (href && href !== "#") window.location.href = href;
            else loadNotifications();
        });
});

document.getElementById("markAll").addEventListener("click", event => {
    withBusy(event.currentTarget, "Marking…", async () => {
        await apiFetch("/api/notifications/read-all", { method: "PATCH" });
        flash("All notifications marked as read.", "success");
        loadNotifications();
    }).catch(error => flash(error.message));
});

initPage().then(() => {
    setupTabs(document.getElementById("notifTabs"), tab => {
        filter = tab;
        loadNotifications();
    })("all");
}).catch(() => {});
