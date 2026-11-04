// ============================================================
// Demo data for presentations and testing:  npm run seed
//
// Creates (only if missing) one account per role, a skills catalogue,
// badges, an employer with active jobs and a trainer with an active
// program. Every demo account uses the password: Demo12345
//
//   admin@demo.nexcraft     learner@demo.nexcraft
//   employer@demo.nexcraft  trainer@demo.nexcraft
// ============================================================

require("dotenv").config();
const crypto = require("crypto");
const { connectDB, getDB } = require("../config/db");
const { hashPassword } = require("../utils/password");
const { generateUserId } = require("../utils/generateId");

const PASSWORD = "Demo12345";

async function ensureUser(db, email, name, role) {
    const existing = await db.collection("users").findOne({ email });
    if (existing) return existing;

    const user = {
        user_id: generateUserId(),
        name,
        email,
        password: await hashPassword(PASSWORD),
        email_verified: true,
        active_role: role,
        roles: [role],
        status: "active",
        created_at: new Date(),
        updated_at: new Date()
    };
    await db.collection("users").insertOne(user);
    console.log(`  user     ${email}  (${role})`);
    return user;
}

async function main() {
    await connectDB();
    const db = getDB();
    const now = new Date();

    console.log("Seeding demo data…");

    await ensureUser(db, "admin@demo.nexcraft", "Demo Admin", "Admin");
    const employer = await ensureUser(db, "employer@demo.nexcraft", "Nadia Rahman", "Employer");
    const trainer = await ensureUser(db, "trainer@demo.nexcraft", "Imran Hossain", "Trainer");
    const learner = await ensureUser(db, "learner@demo.nexcraft", "Sadia Akter", "Learner");

    // Skills catalogue
    const skills = [
        ["HTML", "Frontend"], ["CSS", "Frontend"], ["JavaScript", "Frontend"],
        ["Node.js", "Backend"], ["Express.js", "Backend"], ["MongoDB", "Database"],
        ["Git", "Tools"], ["REST APIs", "Backend"], ["Figma", "Design"], ["Python", "General"]
    ];
    for (const [name, category] of skills) {
        await db.collection("skills").updateOne(
            { name },
            { $setOnInsert: { skill_id: `SKL-${crypto.randomUUID()}`, name, category, created_at: now } },
            { upsert: true }
        );
    }
    console.log(`  skills   ${skills.length}`);

    // Badges
    const badges = [
        ["Top Performer", "🏆", "Outstanding results in a NexCraft program"],
        ["Project Complete", "🚀", "Shipped a complete portfolio project"],
        ["Team Player", "🤝", "Great collaboration with peers"]
    ];
    for (const [name, icon, description] of badges) {
        await db.collection("badges").updateOne(
            { name },
            { $setOnInsert: { badge_id: `BDG-${crypto.randomUUID()}`, name, icon, description, created_at: now } },
            { upsert: true }
        );
    }
    console.log(`  badges   ${badges.length}`);

    // Employer profile + jobs
    await db.collection("employer_profiles").updateOne(
        { user_id: employer.user_id },
        {
            $setOnInsert: {
                user_id: employer.user_id,
                company_name: "BrightLabs Technologies",
                contact_phone: "+880 1711-123456",
                website: "https://brightlabs.example",
                industry: "Software",
                location: "Dhaka",
                description: "We build learning and HR products for South Asian companies.",
                created_at: now,
                updated_at: now
            }
        },
        { upsert: true }
    );

    const jobs = [
        ["Junior Node.js Developer", "Web Development", "Full-time", "Dhaka (Hybrid)", 35000, 50000, ["Node.js", "Express.js", "MongoDB"]],
        ["Frontend Intern", "Web Development", "Internship", "Remote", 12000, 15000, ["HTML", "CSS", "JavaScript"]],
        ["UI/UX Designer", "UI/UX Design", "Part-time", "Chattogram", 25000, 35000, ["Figma", "CSS"]]
    ];
    for (const [title, category, job_type, location, salary_min, salary_max, skill_tags] of jobs) {
        await db.collection("jobs").updateOne(
            { employer_id: employer.user_id, title },
            {
                $setOnInsert: {
                    job_id: `JOB-${crypto.randomUUID()}`,
                    employer_id: employer.user_id,
                    user_id: employer.user_id,
                    company: "BrightLabs Technologies",
                    company_name: "BrightLabs Technologies",
                    title, category, job_type, location, salary_min, salary_max, skill_tags,
                    description: `${title} at BrightLabs. You will work with a small team on real products used by thousands of learners.`,
                    responsibilities: "Build features end to end\nWrite clear code and tests\nReview pull requests",
                    requirements: `Comfortable with ${skill_tags.join(", ")}\nGood communication in English or Bangla`,
                    status: "active",
                    rejection_reason: "",
                    submitted_at: now,
                    approved_at: now,
                    created_at: now,
                    updated_at: now
                }
            },
            { upsert: true }
        );
    }
    console.log(`  jobs     ${jobs.length} (active)`);

    // Trainer profile + program
    await db.collection("trainer_profiles").updateOne(
        { user_id: trainer.user_id },
        {
            $setOnInsert: {
                user_id: trainer.user_id,
                trainer_id: trainer.user_id,
                expertise_area: "Full-stack JavaScript",
                bio: "Ten years building web apps; loves teaching beginners.",
                created_at: now,
                updated_at: now
            }
        },
        { upsert: true }
    );

    await db.collection("training_programs").updateOne(
        { trainer_id: trainer.user_id, title: "Express & MongoDB Bootcamp" },
        {
            $setOnInsert: {
                program_id: `TRN-${crypto.randomUUID()}`,
                trainer_id: trainer.user_id,
                user_id: trainer.user_id,
                title: "Express & MongoDB Bootcamp",
                category: "Web Development",
                mode: "Online",
                duration: "6 weeks",
                level: "Beginner",
                description: "Build a complete REST API with Express and the MongoDB driver, from zero to deployment.",
                prerequisites: "Basic JavaScript",
                skill_tags: ["Node.js", "Express.js", "MongoDB"],
                status: "active",
                rejection_reason: "",
                created_at: now,
                updated_at: now
            }
        },
        { upsert: true }
    );
    console.log("  program  1 (active)");

    // Learner profile (no CV: upload one from the Edit Profile page)
    await db.collection("learner_profiles").updateOne(
        { user_id: learner.user_id },
        {
            $setOnInsert: {
                user_id: learner.user_id,
                phone: "01800000000",
                location: "Dhaka",
                education: "BSc in CSE",
                career: "Fresh graduate",
                track: "Web Development",
                employment_status: "Student",
                experience_level: "Less than 1 year",
                skills: ["HTML", "CSS", "JavaScript", "MongoDB"],
                skill_levels: { HTML: "Advanced", CSS: "Intermediate", JavaScript: "Intermediate", MongoDB: "Beginner" },
                bio: "Final-year CSE student who enjoys building accessible web apps.",
                profile_image: null,
                cv: null,
                profile_completed: 82,
                status: "active",
                created_at: now,
                updated_at: now
            }
        },
        { upsert: true }
    );

    console.log(`\nDone. Log in with any demo account, password: ${PASSWORD}`);
    process.exit(0);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
