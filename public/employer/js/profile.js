// Employer company profile (FR-22)
const FIELDS = ["company_name", "industry", "contact_phone", "website", "location", "description"];
const form = document.getElementById("profileForm");

initPage().then(async () => {
    try {
        const { profile } = await apiFetch("/api/employers/profile");

        if (profile) {
            FIELDS.forEach(field => {
                document.getElementById(field).value = profile[field] || "";
            });
        } else {
            flash("Welcome! Add your company details to start posting jobs.", "success");
        }
    } catch (error) {
        flash(error.message);
    }
}).catch(() => {});

form.addEventListener("submit", async event => {
    event.preventDefault();

    const body = Object.fromEntries(FIELDS.map(f => [f, document.getElementById(f).value.trim()]));

    if (!body.company_name || !body.contact_phone) {
        flash("Company name and contact phone are required.");
        return;
    }

    const button = form.querySelector('button[type="submit"]');

    try {
        await withBusy(button, "Saving…", () =>
            apiFetch("/api/employers/profile", { method: "PUT", body }));

        // First-time setup goes straight on to posting a job
        const firstTime = new URLSearchParams(location.search).get("setup") === "1" ||
            document.referrer.includes("role-selection");

        flash("Company profile saved.", "success");

        if (firstTime) {
            setTimeout(() => { window.location.href = "/employer/dashboard.html"; }, 800);
        }
    } catch (error) {
        flash(error.message);
    }
});
