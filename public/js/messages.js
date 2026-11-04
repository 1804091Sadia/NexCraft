// Messages inbox (FR-33, FR-34) — shared by every role
const messenger = document.getElementById("messenger");
const listEl = document.getElementById("conversations");
const threadEl = document.getElementById("thread");

let me = null;
let activeUserId = new URLSearchParams(location.search).get("with");
let conversations = [];

async function loadConversations() {
    try {
        const data = await apiFetch("/api/messages/conversations");
        conversations = data.conversations;

        if (!conversations.length && !activeUserId) {
            listEl.innerHTML = emptyState("No messages yet",
                "Conversations start from an application, an enrollment or a candidate profile.");
            return;
        }

        listEl.innerHTML = conversations.map(c => `
            <button type="button" class="conversation ${c.user_id === activeUserId ? "active" : ""}" data-user="${escapeHTML(c.user_id)}">
                ${avatar(c.name, null, 38)}
                <span class="meta">
                    <strong>${escapeHTML(c.name)}</strong>
                    <span class="preview">${c.last_from_me ? "You: " : ""}${escapeHTML(c.last_message)}</span>
                </span>
                ${c.unread ? `<span class="unread-dot" aria-label="${c.unread} unread">${c.unread}</span>` : ""}
            </button>`).join("");

    } catch (error) {
        listEl.innerHTML = emptyState("Could not load messages", error.message);
    }
}

async function openThread(userId) {
    activeUserId = userId;
    messenger.classList.add("thread-open");

    const url = new URL(location.href);
    url.searchParams.set("with", userId);
    history.replaceState(null, "", url);

    threadEl.innerHTML = loadingState();

    try {
        const { user, messages } = await apiFetch(`/api/messages/with/${encodeURIComponent(userId)}`);

        // Reply in the same context as the last message (e.g. an application)
        const lastWithContext = [...messages].reverse().find(m => m.context_type);

        threadEl.innerHTML = `
            <div class="thread-head">
                <button type="button" class="btn btn-outline btn-sm" id="backToList" style="margin-right:8px;">←</button>
                ${escapeHTML(user.name)}
                ${user.active_role ? `<span class="chip" style="margin-left:6px;">${escapeHTML(user.active_role)}</span>` : ""}
            </div>
            <div class="thread-messages" id="threadMessages">
                ${messages.length ? messages.map(m => `
                    <div class="bubble ${m.sender_id === me.user_id ? "mine" : ""}">
                        ${m.context_label ? `<span class="context">Re: ${escapeHTML(m.context_label)}</span>` : ""}
                        ${escapeHTML(m.body)}
                        <time>${formatDate(m.created_at, true)}</time>
                    </div>`).join("")
                    : `<p class="muted" style="text-align:center;">Say hello 👋</p>`}
            </div>
            <form class="composer" id="composer">
                <label for="replyBody" class="sr-only">Message</label>
                <textarea id="replyBody" class="form-control" maxlength="2000" placeholder="Write a message…" required></textarea>
                <button type="submit" class="btn btn-primary">Send</button>
            </form>`;

        const box = document.getElementById("threadMessages");
        box.scrollTop = box.scrollHeight;

        document.getElementById("backToList").addEventListener("click", () => {
            messenger.classList.remove("thread-open");
        });

        const composer = document.getElementById("composer");
        const textarea = document.getElementById("replyBody");

        // Enter sends, Shift+Enter makes a new line
        textarea.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                composer.requestSubmit();
            }
        });

        composer.addEventListener("submit", async event => {
            event.preventDefault();
            const body = textarea.value.trim();
            if (!body) return;

            try {
                await withBusy(composer.querySelector("button"), "Sending…", () =>
                    apiFetch("/api/messages", {
                        method: "POST",
                        body: {
                            receiver_id: userId,
                            body,
                            context_type: lastWithContext?.context_type || "",
                            context_id: lastWithContext?.context_id || ""
                        }
                    }));
                openThread(userId);
                loadConversations();
            } catch (error) {
                flash(error.message);
            }
        });

        textarea.focus();
        loadConversations();

    } catch (error) {
        threadEl.innerHTML = emptyState("Could not open conversation", error.message);
    }
}

listEl.addEventListener("click", event => {
    const item = event.target.closest("[data-user]");
    if (item) openThread(item.dataset.user);
});

initPage().then(async user => {
    me = user;
    await loadConversations();
    if (activeUserId) openThread(activeUserId);

    // Light polling; real-time chat is out of scope (spec 2.2)
    setInterval(loadConversations, 30 * 1000);
}).catch(() => {});
