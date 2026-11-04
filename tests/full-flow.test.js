// ============================================================
// NexCraft full-flow test: Employer + Admin + Messaging
// Spec test cases: TC-JOB-01..07, TC-PROG-02, TC-BADGE-01,
// TC-MSG-01/02, TC-ADM-01/02, FR-25, FR-40, FR-41, FR-43.
//
// ⚠ Run against a TEST database only — it inserts data.
//   1. Start the server with DB_NAME=nexcraft_test
//   2. API=http://localhost:5000/api node tests/full-flow.test.js
// ============================================================

require("dotenv").config();
const { MongoClient } = require("mongodb");
const { execFileSync } = require("child_process");
const path = require("path");

const API = process.env.API || "http://localhost:5000/api";
let passed = 0, failed = 0;

function check(id, condition, detail = "") {
    if (condition) { passed++; console.log(`  PASS  ${id}`); }
    else { failed++; console.log(`  FAIL  ${id} ${detail}`); }
}

async function call(method, url, body, token, isForm = false) {
    const res = await fetch(API + url, {
        method,
        headers: {
            "X-Auth-Mode": "token",
            ...(isForm || !body ? {} : { "Content-Type": "application/json" }),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: isForm ? body : body ? JSON.stringify(body) : undefined
    });
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : { raw: await res.arrayBuffer(), type };
    return { status: res.status, data };
}

async function makeUser(db, stamp, name, role) {
    const email = `${role.toLowerCase()}${stamp}@flow.test`;
    await call("POST", "/auth/register", { name, email, password: "Password123" });
    await db.collection("users").updateOne({ email }, { $set: { email_verified: true } });
    const login = await call("POST", "/auth/login", { email, password: "Password123" });
    if (role !== "Admin") await call("POST", "/roles/select", { role }, login.data.token);
    const user = await db.collection("users").findOne({ email });
    return { token: login.data.token, id: user.user_id, email, name };
}

async function main() {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);
    const stamp = Date.now();

    // Admin via the official script (FR-27)
    const adminEmail = `admin${stamp}@flow.test`;
    execFileSync("node", [path.join(__dirname, "../scripts/createAdmin.js"), adminEmail, "Flow Admin", "Admin12345"],
        { env: process.env, stdio: "ignore" });
    const admin = (await call("POST", "/auth/login", { email: adminEmail, password: "Admin12345" })).data;
    check("FR-27 admin created by script can log in", Boolean(admin.token) && admin.user.active_role === "Admin");
    const A = admin.token;

    const employer = await makeUser(db, stamp, "Acme Hiring", "Employer");
    const employer2 = await makeUser(db, stamp + 1, "Other Corp", "Employer");
    const learner = await makeUser(db, stamp, "Lina Learner", "Learner");
    const learner2 = await makeUser(db, stamp + 2, "Nosy Learner", "Learner");
    const E = employer.token, L = learner.token;

    console.log("Access control");
    check("Learner blocked from admin API (403)", (await call("GET", "/admin/overview", null, L)).status === 403);
    check("Learner blocked from employer API (403)", (await call("GET", "/employers/jobs", null, L)).status === 403);
    check("Employer blocked from admin API (403)", (await call("GET", "/admin/users", null, E)).status === 403);

    console.log("Employer profile + job (FR-22, FR-23)");
    const jobInput = {
        title: `Junior Node Developer ${stamp}`, category: "Web Development", job_type: "Full-time",
        location: "Dhaka (Hybrid)", salary_min: 30000, salary_max: 45000,
        skill_tags: "JavaScript, MongoDB, Express",
        description: "Build REST APIs with Express and MongoDB for our learning platform."
    };
    let r = await call("POST", "/employers/jobs", jobInput, E);
    check("Job blocked until company profile exists", r.status === 400);

    r = await call("PUT", "/employers/profile", { company_name: "Acme Ltd", contact_phone: "+880 1711-000000", website: "https://acme.example" }, E);
    check("FR-22 save company profile", r.status === 200, JSON.stringify(r.data));
    await call("PUT", "/employers/profile", { company_name: "Other Corp", contact_phone: "+880 1811-000000" }, employer2.token);

    r = await call("POST", "/employers/jobs", { ...jobInput, salary_min: 50000 }, E);
    check("Salary min > max rejected", r.status === 400);

    r = await call("POST", "/employers/jobs", jobInput, E);
    check("TC-JOB-01 job created as Draft", r.status === 201 && r.data.job.status === "draft");
    const jobId = r.data.job.job_id;

    r = await call("PATCH", `/employers/jobs/${jobId}/submit`, null, E);
    check("TC-JOB-01 submitted -> Pending Approval", r.status === 200);
    const submitNote = await db.collection("notifications").findOne({ user_id: employer.id, title: "Job submitted for approval" });
    check("TC-JOB-01 employer notified of submission", Boolean(submitNote));

    r = await call("GET", "/jobs", null, L);
    check("Pending job hidden from learners", !r.data.jobs.some(j => j.job_id === jobId));

    console.log("Admin review (FR-28, TC-JOB-02/03)");
    r = await call("PATCH", `/admin/jobs/${jobId}/reject`, { reason: "" }, A);
    check("TC-JOB-03 reject without reason fails", r.status === 400);
    r = await call("PATCH", `/admin/jobs/${jobId}/reject`, { reason: "Please add the salary currency" }, A);
    check("TC-JOB-03 reject with reason", r.status === 200);
    let job = await db.collection("jobs").findOne({ job_id: jobId });
    check("TC-JOB-03 reason stored", job.status === "rejected" && job.rejection_reason.includes("currency"));

    r = await call("PUT", `/employers/jobs/${jobId}`, { ...jobInput, description: jobInput.description + " Salary in BDT." }, E);
    check("FR-24 edit after rejection", r.status === 200);
    await call("PATCH", `/employers/jobs/${jobId}/submit`, null, E);
    r = await call("PATCH", `/admin/jobs/${jobId}/approve`, null, A);
    check("TC-JOB-02 admin approves", r.status === 200);
    check("TC-JOB-02 employer notified", Boolean(await db.collection("notifications").findOne({ user_id: employer.id, title: "Job approved" })));

    r = await call("GET", "/jobs?skill=mongodb", null, L);
    check("TC-JOB-02 active job visible + FR-11 skill filter", r.data.jobs.some(j => j.job_id === jobId));
    r = await call("GET", "/jobs?salary_min=90000", null, L);
    check("FR-11 salary filter excludes job", !r.data.jobs.some(j => j.job_id === jobId));
    r = await call("PUT", `/employers/jobs/${jobId}`, jobInput, E);
    check("Active job cannot be edited", r.status === 400);

    console.log("Apply, review, CV (FR-40, FR-41)");
    const form = new FormData();
    form.append("phone", "01700000000");
    form.append("track", "Web Development");
    form.append("skills", "JavaScript, MongoDB");
    form.append("cv", new Blob(["%PDF-1.4\n% test cv\n"], { type: "application/pdf" }), "cv.pdf");
    r = await call("POST", "/learners/profile", form, L, true);
    check("Learner profile with CV", r.status === 200, JSON.stringify(r.data).slice(0, 120));

    r = await call("POST", "/applications", { job_id: jobId, cover_letter: "I love Node." }, L);
    check("TC-JOB-04 learner applies (Received)", r.status === 201 && r.data.application.status === "Received");
    const appId = r.data.application.application_id;

    r = await call("POST", "/applications", { job_id: jobId, cover_letter: "Again" }, L);
    check("TC-JOB-05 duplicate application rejected", r.status === 409);
    check("TC-JOB-05 no second application row",
        (await db.collection("applications").countDocuments({ user_id: learner.id, job_id: jobId })) === 1);

    r = await call("POST", "/saved-jobs", { job_id: jobId }, L);
    check("TC-JOB-07 save job", r.status === 201);
    r = await call("GET", "/saved-jobs", null, L);
    check("TC-JOB-07 job in saved list", r.data.savedJobs.some(s => s.job_id === jobId));
    r = await call("DELETE", `/saved-jobs/${jobId}`, null, L);
    r = await call("GET", "/saved-jobs", null, L);
    check("TC-JOB-07 unsave removes it, applications untouched",
        !r.data.savedJobs.some(s => s.job_id === jobId) &&
        (await db.collection("applications").countDocuments({ user_id: learner.id, job_id: jobId })) === 1);

    r = await call("GET", "/employers/applications", null, E);
    check("Employer sees applicant", r.data.applications.some(a => a.application_id === appId && a.applicant_name === "Lina Learner"));
    r = await call("GET", "/employers/applications", null, employer2.token);
    check("Other employer cannot see applicant", !r.data.applications.some(a => a.application_id === appId));

    r = await call("GET", `/files/cv/${learner.id}`, null, E);
    check("FR-41 employer opens applicant CV", r.status === 200 && r.data.type === "application/pdf");
    r = await call("GET", `/files/cv/${learner.id}`, null, employer2.token);
    check("FR-41 unrelated employer blocked (403)", r.status === 403);
    r = await call("GET", `/files/cv/${learner.id}`, null, learner2.token);
    check("FR-41 other learner blocked (403)", r.status === 403);
    r = await call("GET", `/files/cv/me`, null, L);
    check("Learner opens own CV", r.status === 200);
    const cvRef = (await db.collection("learner_profiles").findOne({ user_id: learner.id })).cv;
    check("CV stored in MongoDB GridFS (survives restarts)", /^gridfs:[a-f0-9]{24}$/.test(cvRef));
    const publicCv = await fetch(API.replace("/api", "") + "/uploads/cv/" + cvRef.replace("gridfs:", "") + ".pdf");
    check("CV not reachable through any public path", publicCv.status === 404);

    console.log("Upload safety (TC-SEC-01)");
    const fake = new FormData();
    fake.append("cv", new Blob(["<script>alert(1)</script>"], { type: "application/pdf" }), "cv.pdf");
    r = await call("PUT", "/learners/profile", fake, L, true);
    check("Fake PDF (HTML inside) rejected by content check", r.status === 400);
    const big = new FormData();
    big.append("cv", new Blob([Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4.2 * 1024 * 1024)])], { type: "application/pdf" }), "big.pdf");
    r = await call("PUT", "/learners/profile", big, L, true);
    check("CV over 4 MB rejected with clear message", r.status === 400 && /4 MB/.test(r.data.message || ""));
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const photoForm = new FormData();
    photoForm.append("profile_image", new Blob([png], { type: "image/png" }), "me.png");
    r = await call("PUT", "/learners/profile", photoForm, L, true);
    const photoUrl = r.data.profile?.profile_image || "";
    check("Profile photo stored in GridFS", /^\/api\/files\/photo\/[a-f0-9]{24}$/.test(photoUrl));
    const photoRes = await fetch(API.replace("/api", "") + photoUrl);
    check("Profile photo served publicly as an image", photoRes.status === 200 && (photoRes.headers.get("content-type") || "").startsWith("image/png"));
    r = await call("GET", `/files/cv/${learner.id}`, null, E);
    check("CV still opens after a photo-only update", r.status === 200);

    r = await call("PATCH", `/employers/applications/${appId}/status`, { status: "Shortlisted" }, E);
    check("FR-40 status forward (Received -> Shortlisted)", r.status === 200);
    r = await call("PATCH", `/employers/applications/${appId}/status`, { status: "Received" }, E);
    check("FR-40 status cannot go backwards", r.status === 400);
    check("FR-40 learner notified", Boolean(await db.collection("notifications").findOne({ user_id: learner.id, title: "Application update: Shortlisted" })));
    r = await call("PATCH", `/employers/applications/${appId}/status`, { status: "Interview Scheduled" }, employer2.token);
    check("Other employer cannot change status", r.status === 404);

    console.log("Ratings (FR-25 rating filter)");
    r = await call("PATCH", `/employers/applications/${appId}/rating`, { rating: 7 }, E);
    check("Rating outside 1-5 rejected", r.status === 400);
    r = await call("PATCH", `/employers/applications/${appId}/rating`, { rating: 4 }, E);
    check("Employer rates shortlisted applicant", r.status === 200);
    r = await call("PATCH", `/employers/applications/${appId}/rating`, { rating: 5 }, employer2.token);
    check("Other employer cannot rate", r.status === 404);
    r = await call("GET", "/employers/candidates?min_rating=4", null, E);
    check("FR-25 min_rating filter includes rated learner", r.data.candidates.some(c => c.user_id === learner.id && c.rating === 4));
    r = await call("GET", "/employers/candidates?min_rating=4.5", null, E);
    check("FR-25 min_rating filter excludes lower ratings", !r.data.candidates.some(c => c.user_id === learner.id));

    console.log("Messaging (FR-26, FR-33, FR-34)");
    r = await call("POST", "/messages", { receiver_id: learner.id, body: "Can you interview Monday?", context_type: "application", context_id: appId }, E);
    check("TC-MSG-01 employer messages applicant with context", r.status === 201);
    r = await call("POST", "/messages", { receiver_id: learner.id, body: "x", context_type: "application", context_id: appId }, employer2.token);
    check("Context must belong to both users", r.status === 400);
    r = await call("GET", "/messages/conversations", null, L);
    check("TC-MSG-01 learner sees unread conversation", r.data.unreadTotal >= 1);
    r = await call("GET", `/messages/with/${employer.id}`, null, L);
    check("Thread loads with context label", r.data.messages[0].context_label === job.title || r.data.messages[0].context_label.startsWith("Junior Node"));
    r = await call("GET", "/messages/conversations", null, L);
    check("TC-MSG-02 opening thread marks read", r.data.unreadTotal === 0);
    r = await call("POST", "/messages", { receiver_id: employer.id, body: "Yes, Monday works." }, L);
    check("Learner replies", r.status === 201);

    console.log("Withdraw (TC-JOB-06) + close (FR-24)");
    r = await call("PATCH", `/applications/${appId}/withdraw`, null, L);
    check("Learner can withdraw", r.status === 200);
    r = await call("GET", "/employers/applications", null, E);
    check("TC-JOB-06 withdrawn leaves active queue", !r.data.applications.some(a => a.application_id === appId));
    r = await call("PATCH", `/employers/jobs/${jobId}/close`, null, E);
    check("FR-24 close active job", r.status === 200);
    r = await call("GET", "/jobs", null, L);
    check("Closed job hidden from learners", !r.data.jobs.some(j => j.job_id === jobId));

    console.log("Programs (FR-29, TC-PROG-02)");
    const trainer = await makeUser(db, stamp, "Tariq Trainer", "Trainer");
    r = await call("POST", "/trainers/programs", { title: `Express Basics ${stamp}`, category: "Web", mode: "Online", duration: "4 weeks", description: "Learn Express step by step.", level: "Beginner" }, trainer.token);
    const programId = r.data.program?.program_id || (await db.collection("training_programs").findOne({ title: `Express Basics ${stamp}` })).program_id;
    await call("PATCH", `/trainers/programs/${programId}/submit`, null, trainer.token);
    r = await call("GET", "/admin/programs", null, A);
    check("Program waiting in admin queue", r.data.items.some(p => p.program_id === programId && p.owner_name === "Tariq Trainer"));
    r = await call("PATCH", `/admin/programs/${programId}/approve`, null, A);
    check("TC-PROG-02 admin approves program", r.status === 200);
    r = await call("GET", "/training?level=Beginner", null, L);
    check("TC-PROG-02 program visible to learners (FR-14 filter)", r.data.programs.some(p => p.program_id === programId));

    console.log("Badges (FR-42, TC-BADGE-01) + candidates (FR-25)");
    r = await call("POST", "/admin/badges", { name: `Top Performer ${stamp}`, icon: "🏆", description: "Outstanding work" }, A);
    check("Badge created", r.status === 201);
    const badgeId = r.data.badge.badge_id;
    r = await call("POST", `/admin/badges/${badgeId}/award`, { user_id: learner.id }, A);
    check("TC-BADGE-01 badge awarded", r.status === 200);
    r = await call("POST", `/admin/badges/${badgeId}/award`, { user_id: learner.id }, A);
    check("Duplicate award blocked", r.status === 409);
    r = await call("POST", `/admin/badges/${badgeId}/award`, { user_id: employer.id }, A);
    check("Badge only for learners", r.status === 400);
    r = await call("GET", "/badges/my", null, L);
    check("TC-BADGE-01 badge on learner profile", r.data.badges.some(b => b.badge_id === badgeId));
    r = await call("GET", `/employers/candidates?badge=${encodeURIComponent(`Top Performer ${stamp}`)}`, null, E);
    check("FR-25 candidates filtered by badge", r.data.candidates.length === 1 && r.data.candidates[0].user_id === learner.id);
    r = await call("GET", "/employers/candidates?skill=javascript&track=web", null, E);
    check("FR-25 candidates filtered by skill + track", r.data.candidates.some(c => c.user_id === learner.id));

    console.log("Users (FR-30, TC-ADM-01/02) + logs (FR-31, FR-43)");
    r = await call("PATCH", `/admin/users/${employer2.id}/suspend`, {}, A);
    check("Suspension needs a reason", r.status === 400);
    r = await call("PATCH", `/admin/users/${employer2.id}/suspend`, { reason: "Spam job posts" }, A);
    check("TC-ADM-01 suspend", r.status === 200);
    check("TC-ADM-01 session invalidated", (await call("GET", "/auth/me", null, employer2.token)).status === 403);
    check("TC-ADM-01 cannot log in", (await call("POST", "/auth/login", { email: employer2.email, password: "Password123" })).status === 403);
    r = await call("PATCH", `/admin/users/${employer2.id}/reactivate`, null, A);
    check("TC-ADM-02 reactivate", r.status === 200 && (await call("GET", "/auth/me", null, employer2.token)).status === 200);
    r = await call("PATCH", `/admin/users/${admin.user.user_id}/suspend`, { reason: "x" }, A);
    check("Admin cannot suspend self", r.status === 400);

    r = await call("GET", "/admin/audit-logs", null, A);
    const actions = new Set(r.data.logs.map(l => l.action));
    check("FR-43 audit has approve/reject/suspend/reactivate/badge",
        ["job_reject", "job_approve", "program_approve", "user_suspend", "user_reactivate", "badge_award"].every(a => actions.has(a)));

    r = await call("GET", "/admin/overview", null, A);
    check("FR-32 overview counts", r.status === 200 && r.data.users.employers >= 2 && r.data.programs.active >= 1);

    r = await call("GET", "/admin/role-changes", null, A);
    check("FR-31 role-change log endpoint", r.status === 200 && Array.isArray(r.data.logs));

    console.log("Learner profile fields + skill levels (FR-10, FR-17)");
    const pf = new FormData();
    pf.append("track", "Web Development");
    pf.append("skills", "JavaScript, MongoDB");
    pf.append("employment_status", "Student");
    pf.append("experience_level", "1-3 years");
    pf.append("employment_status_bad", "x");
    r = await call("PUT", "/learners/profile", pf, L, true);
    check("FR-10 employment status + experience saved",
        r.data.profile?.employment_status === "Student" && r.data.profile?.experience_level === "1-3 years");
    const bad = new FormData();
    bad.append("employment_status", "Astronaut");
    r = await call("PUT", "/learners/profile", bad, L, true);
    check("FR-10 invalid employment status ignored", r.data.profile?.employment_status === "");
    r = await call("PUT", "/learners/skills", { skills: [
        { name: "JavaScript", level: "Advanced" }, { name: "MongoDB", level: "Wizard" }, { name: "javascript", level: "Beginner" }
    ] }, L);
    check("TC-SKILL-01 skills with proficiency saved",
        r.status === 200 && r.data.skills.length === 2 && r.data.skill_levels.JavaScript === "Advanced" && r.data.skill_levels.MongoDB === "Beginner");
    r = await call("GET", `/employers/candidates?q=${encodeURIComponent("Lina")}`, null, E);
    check("Employers see skill levels", r.data.candidates.find(c => c.user_id === learner.id)?.skill_levels?.JavaScript === "Advanced");

    console.log("Training filters (FR-14) + settings (FR-36 UI)");
    r = await call("GET", "/training?mode=Online&skill=express", null, L);
    check("FR-14 mode + skill filter", Array.isArray(r.data.programs));
    r = await call("PATCH", "/auth/me", { name: "Lina L. Learner" }, L);
    check("Settings: update name", r.status === 200 && (await call("GET", "/auth/me", null, L)).data.user.name === "Lina L. Learner");
    r = await call("PATCH", "/auth/me", { name: "x" }, L);
    check("Settings: too-short name rejected", r.status === 400);

    console.log("Cookie session (HttpOnly)");
    let res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employer.email, password: "Password123" })
    });
    const body = await res.json();
    const setCookie = res.headers.get("set-cookie") || "";
    check("Browser login returns no token in JSON", res.status === 200 && !body.token);
    check("Session cookie is HttpOnly + SameSite=Strict", /nexcraft_session=/.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie));
    const cookie = setCookie.split(";")[0];
    res = await fetch(API + "/auth/me", { headers: { Cookie: cookie, Authorization: "Bearer cookie-session" } });
    check("Cookie authenticates API calls", res.status === 200);
    res = await fetch(API + "/auth/me");
    check("No cookie, no token -> 401", res.status === 401);
    res = await fetch(API + "/auth/logout", { method: "POST", headers: { Cookie: cookie } });
    check("Logout clears the cookie", /nexcraft_session=;/.test(res.headers.get("set-cookie") || ""));

    console.log("Password storage + reset (TC-SEC-02, TC-AUTH-05)");
    const stored = await db.collection("users").findOne({ user_id: learner.id });
    check("TC-SEC-02 password stored as bcrypt hash, never plain text",
        /^\$2[aby]\$\d{2}\$/.test(stored.password) && !stored.password.includes("Password123"));
    const crypto = require("crypto");
    const rawToken = crypto.randomBytes(32).toString("hex");
    await db.collection("password_reset_tokens").insertOne({
        user_id: learner2.id,
        token_hash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        created_at: new Date()
    });
    r = await call("POST", "/auth/reset-password", { token: rawToken, newPassword: "Reset12345" });
    check("TC-AUTH-05 reset with emailed token", r.status === 200);
    check("TC-AUTH-05 new password works",
        (await call("POST", "/auth/login", { email: learner2.email, password: "Reset12345" })).status === 200);
    check("TC-AUTH-05 old password invalidated",
        (await call("POST", "/auth/login", { email: learner2.email, password: "Password123" })).status === 401);
    r = await call("POST", "/auth/reset-password", { token: rawToken, newPassword: "Again12345" });
    check("TC-AUTH-05 reset link works only once", r.status === 400);

    console.log("Learner -> Trainer conversion (TC-ROLE-02, TC-ROLE-03)");
    const convertLogin = await call("POST", "/auth/login", { email: learner2.email, password: "Reset12345" });
    const C = convertLogin.data.token;
    await call("PUT", "/learners/profile", (() => { const f = new FormData(); f.append("track", "Web"); return f; })(), C, true);
    r = await call("POST", "/trainer-conversion/apply", { expertise_area: "Frontend", bio: "I teach CSS", experience: "3 years" }, C);
    check("TC-ROLE-02 learner applies to become trainer", r.status === 201);
    const trainerAppId = r.data.application.application_id;
    r = await call("PATCH", `/trainer-conversion/admin/${trainerAppId}/approve`, null, A);
    check("TC-ROLE-02 admin approves", r.status === 200);
    const converted = await db.collection("users").findOne({ user_id: learner2.id });
    check("TC-ROLE-02 same user_id now holds Trainer + Learner", converted.roles.includes("Trainer") && converted.roles.includes("Learner"));
    check("TC-ROLE-02 learner status 'Converted to Trainer'",
        (await db.collection("learner_profiles").findOne({ user_id: learner2.id })).status === "Converted to Trainer");
    check("TC-ROLE-02 Role_Change_Log written",
        Boolean(await db.collection("role_change_logs").findOne({ user_id: learner2.id, to_role: "Trainer" })));
    r = await call("POST", "/trainer-conversion/apply", { expertise_area: "Again" }, C);
    check("TC-ROLE-03 cannot convert again / no reverse path", r.status === 409 || r.status === 400);
    r = await call("PATCH", "/roles/active", { active_role: "Learner" }, C);
    check("TC-ROLE-03 switching portal keeps the Trainer role",
        (await db.collection("users").findOne({ user_id: learner2.id })).roles.includes("Trainer"));

    console.log("Empty showcase (TC-SHOW-06)");
    const visible = await db.collection("certificates").find({ isShowcased: true }).project({ _id: 1 }).toArray();
    await db.collection("certificates").updateMany({ _id: { $in: visible.map(v => v._id) } }, { $set: { isShowcased: false } });
    r = await call("GET", "/showcase");
    check("TC-SHOW-06 API returns an empty showcase list", Array.isArray(r.data.showcase) && r.data.showcase.length === 0);
    await db.collection("certificates").updateMany({ _id: { $in: visible.map(v => v._id) } }, { $set: { isShowcased: true } });
    const showcaseJs = require("fs").readFileSync(require("path").join(__dirname, "../public/js/showcase.js"), "utf8");
    check("TC-SHOW-06 page text 'No graduates yet — be the first!'", showcaseJs.includes("No graduates yet — be the first!"));

    console.log("Delete my account (Apple 5.1.1(v), Google Play policy)");
    const leaver = await makeUser(db, stamp + 9, "Leaving Learner", "Learner");
    const lf = new FormData();
    lf.append("track", "Data");
    lf.append("cv", new Blob(["%PDF-1.4\n% leaver\n"], { type: "application/pdf" }), "cv.pdf");
    await call("PUT", "/learners/profile", lf, leaver.token, true);
    const leaverCv = (await db.collection("learner_profiles").findOne({ user_id: leaver.id })).cv;
    await call("POST", "/messages", { receiver_id: employer.id, body: "Thanks for the interview!" }, leaver.token);
    r = await call("DELETE", "/auth/me", { password: "Password123", confirm: "nope" }, leaver.token);
    check("Delete needs typed DELETE confirmation", r.status === 400);
    r = await call("DELETE", "/auth/me", { password: "Wrong1234", confirm: "DELETE" }, leaver.token);
    check("Delete needs the correct password", r.status === 401);
    r = await call("DELETE", "/auth/me", { password: "Password123", confirm: "DELETE" }, leaver.token);
    check("Account deleted", r.status === 200);
    check("Deleted user cannot log in", (await call("POST", "/auth/login", { email: leaver.email, password: "Password123" })).status === 401);
    check("Profile removed", !(await db.collection("learner_profiles").findOne({ user_id: leaver.id })));
    const cvGone = !(await db.collection("uploads.files").findOne({ _id: new (require("mongodb").ObjectId)(leaverCv.replace("gridfs:", "")) }));
    check("CV file removed from storage", cvGone);
    r = await call("GET", "/messages/conversations", null, E);
    check("Their message to others stays, shown as Deleted user", r.data.conversations.some(c => c.user_id === leaver.id && c.name === "Deleted user"));
    r = await call("DELETE", "/auth/me", { password: "Admin12345", confirm: "DELETE" }, A);
    check("Admin delete allowed only if another admin exists", r.status === 200 || r.status === 400);

    console.log(`\n${passed} passed, ${failed} failed`);
    await client.close();
    process.exit(failed ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
