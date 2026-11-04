// ============================================================
// Create MongoDB indexes — run once:  node scripts/createIndexes.js
// ============================================================

require("dotenv").config();
const { connectDB, getDB } = require("../config/db");

async function main() {
    await connectDB();
    const db = getDB();

    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ user_id: 1 }, { unique: true });

    await db.collection("learner_profiles").createIndex({ user_id: 1 }, { unique: true });
    await db.collection("trainer_profiles").createIndex({ user_id: 1 }, { unique: true });

    await db.collection("applications").createIndex({ user_id: 1, job_id: 1 }, { unique: true });
    await db.collection("applications").createIndex({ application_id: 1 }, { unique: true });

    await db.collection("enrollments").createIndex({ user_id: 1, program_id: 1 }, { unique: true });
    await db.collection("enrollments").createIndex({ enrollment_id: 1 }, { unique: true });

    await db.collection("saved_jobs").createIndex({ user_id: 1, job_id: 1 }, { unique: true });

    await db.collection("certificates").createIndex({ enrollment_id: 1 }, { unique: true });
    await db.collection("certificates").createIndex({ isShowcased: 1, issued_at: -1 });

    await db.collection("jobs").createIndex({ status: 1, created_at: -1 });
    await db.collection("training_programs").createIndex({ status: 1, created_at: -1 });

    await db.collection("notifications").createIndex({ user_id: 1, is_read: 1, created_at: -1 });

    await db.collection("password_reset_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await db.collection("email_verification_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

    console.log("Indexes created");
    process.exit(0);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
