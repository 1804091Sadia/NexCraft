// ============================================================
// NexCraft smoke test — maps to the Feature Spec test-case IDs.
// Uses only Node's built-in fetch + the mongodb driver.
//
// ⚠ Run against a TEST database only — it inserts and deletes data.
//   1. Start the server with DB_NAME=nexcraft_test
//   2. node scripts/createAdmin.js admin@nc.com "Site Admin" "Admin12345"
//   3. API=http://localhost:5000/api node tests/smoke.test.js
// ============================================================

require("dotenv").config();
const { MongoClient } = require("mongodb");

const API = process.env.API || "http://localhost:5000/api";
const ADMIN = { email: process.env.ADMIN_EMAIL || "admin@nc.com", password: process.env.ADMIN_PASSWORD || "Admin12345" };

let passed = 0, failed = 0;
function check(id, condition, detail = "") {
    if (condition) { passed++; console.log(`  PASS  ${id}`); }
    else { failed++; console.log(`  FAIL  ${id} ${detail}`); }
}

async function call(method, path, body, token) {
    const res = await fetch(API + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-Auth-Mode": "token",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch { data = { nonJson: true }; }
    return { status: res.status, data };
}

async function main() {
    const client = await MongoClient.connect(process.env.MONGO_URI);
    const db = client.db(process.env.DB_NAME);
    const stamp = Date.now();
    const learnerEmail = `learner${stamp}@test.com`;
    const trainerEmail = `trainer${stamp}@test.com`;

    console.log("Auth");
    let r = await call("POST", "/auth/register", { name: "Test Learner", email: learnerEmail, password: "short" });
    check("FR-36 weak password rejected", r.status === 400);

    r = await call("POST", "/auth/register", { name: "Test Learner", email: learnerEmail, password: "Learner123" });
    check("TC-AUTH-01 register", r.status === 201, JSON.stringify(r.data));

    r = await call("POST", "/auth/register", { name: "Dup", email: learnerEmail, password: "Learner123" });
    check("TC-AUTH-02 duplicate email", r.status === 409);

    const user = await db.collection("users").findOne({ email: learnerEmail });
    if (process.env.EMAIL_VERIFICATION_ENABLED === "true") {
        r = await call("POST", "/auth/login", { email: learnerEmail, password: "Learner123" });
        check("FR-01 unverified login blocked", r.status === 403);
        await db.collection("users").updateOne({ user_id: user.user_id }, { $set: { email_verified: true } });
    }

    r = await call("POST", "/auth/login", { email: learnerEmail, password: "Wrong1234" });
    check("TC-AUTH-04 wrong password generic error", r.status === 401 && r.data.message === "Invalid email or password");

    r = await call("POST", "/auth/login", { email: learnerEmail, password: "Learner123" });
    check("TC-AUTH-03 login", r.status === 200 && r.data.token);
    let learnerToken = r.data.token;

    r = await call("POST", "/auth/forgot-password", { email: learnerEmail });
    check("FR-03 forgot-password route exists", r.status === 200 && !r.data.nonJson);

    await new Promise(res => setTimeout(res, 1100)); // tokens have 1s iat resolution
    r = await call("POST", "/auth/change-password", { currentPassword: "Learner123", newPassword: "Learner456" }, learnerToken);
    check("FR-36 change password", r.status === 200, JSON.stringify(r.data));
    const oldToken = learnerToken;
    learnerToken = r.data.token;

    r = await call("GET", "/auth/me", null, oldToken);
    check("Old token rejected after password change", r.status === 401);

    r = await call("GET", "/does-not-exist", null, learnerToken);
    check("Unknown API route returns JSON 404", r.status === 404 && !r.data.nonJson);

    console.log("Roles");
    r = await call("POST", "/roles/select", { role: "Learner" }, learnerToken);
    check("TC-ROLE-01 select Learner", r.status === 200);

    console.log("Training + showcase");
    r = await call("POST", "/auth/login", ADMIN);
    const adminToken = r.data.token;
    check("Admin login (createAdmin script)", Boolean(adminToken));

    await call("POST", "/auth/register", { name: "Test Trainer", email: trainerEmail, password: "Trainer123" });
    await db.collection("users").updateOne({ email: trainerEmail }, { $set: { email_verified: true } });
    r = await call("POST", "/auth/login", { email: trainerEmail, password: "Trainer123" });
    const trainerToken = r.data.token;
    await call("POST", "/roles/select", { role: "Trainer" }, trainerToken);

    r = await call("POST", "/trainers/programs", {
        title: `Node Bootcamp ${stamp}`, category: "Web", mode: "Online",
        duration: "4 weeks", description: "Express and MongoDB", level: "Beginner"
    }, trainerToken);
    check("TC-PROG-01 trainer creates program", r.status === 201, JSON.stringify(r.data));
    const programId = r.data.program?.program_id ||
        (await db.collection("training_programs").findOne({ title: `Node Bootcamp ${stamp}` })).program_id;

    r = await call("PATCH", `/trainers/programs/${programId}/submit`, null, trainerToken);
    check("Trainer submits program for admin approval", r.status === 200);
    r = await call("GET", "/admin/programs?status=pending_approval", null, adminToken);
    check("Admin sees pending program", r.data.items?.some(program => program.program_id === programId));
    r = await call("PATCH", `/admin/programs/${programId}/approve`, null, trainerToken);
    check("Trainer cannot approve own program", r.status === 403);
    r = await call("PATCH", `/admin/programs/${programId}/approve`, null, adminToken);
    check("Admin approves program", r.status === 200, JSON.stringify(r.data));

    r = await call("POST", "/enrollments", { program_id: programId }, learnerToken);
    check("TC-PROG-03 enroll", r.status === 201);
    const enrollmentId = r.data.enrollment.enrollment_id;

    r = await call("POST", "/enrollments", { program_id: programId }, learnerToken);
    check("TC-PROG-04 duplicate enrollment", r.status === 409);

    r = await call("PATCH", `/enrollments/${enrollmentId}/progress`, { progress: 100 }, learnerToken);
    check("Learner cannot self-complete (no self-certificate)", r.status === 400);

    r = await call("PATCH", `/trainers/enrollments/${enrollmentId}/status`, { status: "In Progress" }, trainerToken);
    check("TC-PROG-05 trainer -> In Progress", r.status === 200, JSON.stringify(r.data));
    r = await call("PATCH", `/trainers/enrollments/${enrollmentId}/status`, { status: "Completed" }, trainerToken);
    check("TC-PROG-05 trainer -> Completed", r.status === 200, JSON.stringify(r.data));

    const cert = await db.collection("certificates").findOne({ enrollment_id: enrollmentId });
    check("TC-SHOW-01 certificate auto-created, isShowcased=true", cert && cert.isShowcased === true);

    r = await call("GET", "/showcase");
    check("TC-SHOW-01 graduate in GET /api/showcase",
        r.data.showcase?.some(g => g.certificate_id === cert?.certificate_id));

    r = await call("GET", "/showcase?limit=3");
    check("TC-SHOW-04 limit respected", r.data.showcase.length <= 3);

    r = await call("PATCH", `/showcase/${cert.certificate_id}/hide`, null, learnerToken);
    check("TC-SHOW-05 learner cannot hide (403)", r.status === 403);

    r = await call("PATCH", `/showcase/${cert.certificate_id}/hide`, null, adminToken);
    check("TC-SHOW-02 admin hides", r.status === 200 && r.data.message === "Hidden from showcase successfully");
    r = await call("GET", "/showcase?limit=9");
    check("TC-SHOW-02 hidden graduate not returned",
        !r.data.showcase.some(g => g.certificate_id === cert.certificate_id));

    r = await call("PATCH", `/showcase/${cert.certificate_id}/show`, null, adminToken);
    check("TC-SHOW-03 admin restores", r.status === 200);

    console.log("Notifications");
    r = await call("GET", "/notifications", null, learnerToken);
    check("FR-35 learner received notifications", r.data.notifications?.length >= 2, JSON.stringify(r.data).slice(0, 200));
    r = await call("PATCH", "/notifications/read-all", null, learnerToken);
    check("FR-44 mark all read", r.status === 200);
    r = await call("GET", "/notifications?unread=true", null, learnerToken);
    check("FR-44 no unread left", r.data.unreadCount === 0);

    console.log("Suspension");
    await db.collection("users").updateOne({ email: learnerEmail }, { $set: { status: "suspended" } });
    r = await call("GET", "/auth/me", null, learnerToken);
    check("TC-ADM-01 existing session invalidated", r.status === 403);
    await db.collection("users").updateOne({ email: learnerEmail }, { $set: { status: "active" } });

    console.log("Rate limit");
    let last;
    for (let i = 0; i < 6; i++) {
        last = await call("POST", "/auth/login", { email: trainerEmail, password: "nope1234" });
    }
    check("FR-02 login rate-limited", last.status === 429);

    console.log(`\n${passed} passed, ${failed} failed`);
    await client.close();
    process.exit(failed ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
