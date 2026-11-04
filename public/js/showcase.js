/* =========================================================
   GRADUATE SHOWCASE SLIDER  (FR-45, FR-47)

   Markup needed on the page:
       <div id="graduateShowcase"></div>
   The script fills it automatically.

   Rules from the spec:
   - up to 9 graduates, newest first (GET /api/showcase?limit=9)
   - 1 card visible < 640px, 2 at 640–1023px, 3 at >= 1024px (CSS)
   - auto-advance every 4 seconds, dots for manual navigation
   - "See All" link to the full graduate list
   - empty state: "No graduates yet — be the first!"
   ========================================================= */

(function () {

    const AUTO_ADVANCE_MS = 4000;

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function initials(name) {
        return String(name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

    function formatDate(value) {
        if (!value) return "";
        return new Date(value).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric"
        });
    }

    // Shared with graduates.html
    function graduateCard(graduate) {
        const avatar = graduate.profile_image
            ? `<img class="showcase-avatar" src="${esc(graduate.profile_image)}" alt="" loading="lazy">`
            : `<div class="showcase-avatar" aria-hidden="true">${esc(initials(graduate.learner_name))}</div>`;

        const level = String(graduate.level || "").toLowerCase();

        return `
            <article class="showcase-card-inner">
                ${avatar}
                <div class="showcase-name">${esc(graduate.learner_name)}</div>
                <div class="showcase-programme">${esc(graduate.programme_title)}</div>
                ${graduate.level
                    ? `<span class="showcase-level level-${esc(level)}">${esc(graduate.level)}</span>`
                    : ""}
                <div class="showcase-meta">
                    Certificate ${esc(graduate.certificate_number)}<br>
                    Completed ${esc(formatDate(graduate.issued_at))}
                </div>
            </article>`;
    }

    window.graduateCard = graduateCard;

    function visibleCount() {
        if (window.innerWidth >= 1024) return 3;
        if (window.innerWidth >= 640) return 2;
        return 1;
    }

    async function initShowcase(container) {
        container.innerHTML = `
            <div class="showcase-head">
                <div>
                    <h2>Recent Graduates</h2>
                    <p>Learners who just completed a NexCraft training programme.</p>
                </div>
                <a href="/graduates.html" class="btn btn-outline">See All</a>
            </div>
            <div class="showcase-body"><div class="showcase-empty">Loading graduates…</div></div>`;

        const body = container.querySelector(".showcase-body");
        let graduates;

        try {
            const response = await fetch("/api/showcase?limit=9");
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            graduates = data.showcase || [];
        } catch {
            body.innerHTML = `<div class="showcase-empty">Graduates could not be loaded right now.</div>`;
            return;
        }

        if (graduates.length === 0) {
            body.innerHTML = `<div class="showcase-empty">No graduates yet — be the first!</div>`;
            return;
        }

        body.innerHTML = `
            <div class="showcase-viewport" aria-roledescription="carousel" aria-label="Recent graduates">
                <div class="showcase-track">
                    ${graduates.map(g => `<div class="showcase-card">${graduateCard(g)}</div>`).join("")}
                </div>
            </div>
            <div class="showcase-dots" role="tablist" aria-label="Choose slide"></div>`;

        const track = body.querySelector(".showcase-track");
        const dotsBox = body.querySelector(".showcase-dots");
        let page = 0;
        let timer = null;

        function pageCount() {
            return Math.max(1, graduates.length - visibleCount() + 1);
        }

        function render() {
            const pages = pageCount();
            if (page >= pages) page = 0;

            const cardWidthPercent = 100 / visibleCount();
            track.style.transform = `translateX(-${page * cardWidthPercent}%)`;

            dotsBox.innerHTML = pages > 1
                ? Array.from({ length: pages }, (_, i) =>
                    `<button type="button" role="tab" aria-label="Slide ${i + 1}"
                        ${i === page ? 'aria-current="true"' : ""} data-page="${i}"></button>`
                  ).join("")
                : "";
        }

        function start() {
            stop();
            if (pageCount() > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                timer = setInterval(() => {
                    page = (page + 1) % pageCount();
                    render();
                }, AUTO_ADVANCE_MS);
            }
        }

        function stop() {
            if (timer) clearInterval(timer);
            timer = null;
        }

        dotsBox.addEventListener("click", event => {
            const dot = event.target.closest("[data-page]");
            if (!dot) return;
            page = Number(dot.dataset.page);
            render();
            start(); // restart the 4s timer after manual navigation
        });

        // Pause while the user is reading
        body.addEventListener("mouseenter", stop);
        body.addEventListener("mouseleave", start);
        body.addEventListener("focusin", stop);
        body.addEventListener("focusout", start);

        let resizeTimer;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { render(); start(); }, 150);
        });

        render();
        start();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const container = document.getElementById("graduateShowcase");
        if (container) initShowcase(container);
    });

})();
