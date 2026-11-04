// Graduate showcase management (FR-46)
const table = document.getElementById("certificatesTable");

async function loadCertificates() {
    table.innerHTML = loadingState();

    try {
        const { certificates } = await apiFetch("/api/admin/certificates");

        if (!certificates.length) {
            table.innerHTML = emptyState("No graduates yet",
                "A certificate is issued when a trainer marks an enrollment Completed.");
            return;
        }

        table.innerHTML = `
            <div class="table-wrap"><table class="data-table">
                <thead><tr><th>Graduate</th><th>Program</th><th>Certificate</th><th>On showcase</th><th></th></tr></thead>
                <tbody>
                ${certificates.map(c => `
                    <tr>
                        <td data-label="Graduate"><div class="person">${avatar(c.learner_name, null, 34)}<strong>${escapeHTML(c.learner_name)}</strong></div></td>
                        <td data-label="Program">${escapeHTML(c.programme_title)}<span class="sub">${escapeHTML(c.level)}</span></td>
                        <td data-label="Certificate">${escapeHTML(c.certificate_number)}<span class="sub">${formatDate(c.issued_at)}</span></td>
                        <td data-label="On showcase">${c.isShowcased ? statusPill("Showcased") : statusPill("Hidden")}</td>
                        <td><div class="actions">
                            <button class="btn ${c.isShowcased ? "btn-outline" : "btn-primary"} btn-sm"
                                data-toggle="${escapeHTML(c.certificate_id)}" data-to="${c.isShowcased ? "hide" : "show"}">
                                ${c.isShowcased ? "Hide" : "Show again"}
                            </button>
                        </div></td>
                    </tr>`).join("")}
                </tbody>
            </table></div>`;

    } catch (error) {
        table.innerHTML = emptyState("Could not load graduates", error.message);
    }
}

table.addEventListener("click", event => {
    const button = event.target.closest("[data-toggle]");
    if (!button) return;

    withBusy(button, "Saving…", async () => {
        const data = await apiFetch(
            `/api/showcase/${encodeURIComponent(button.dataset.toggle)}/${button.dataset.to}`,
            { method: "PATCH" });
        flash(data.message, "success");
        loadCertificates();
    }).catch(error => flash(error.message));
});

initPage().then(loadCertificates).catch(() => {});
