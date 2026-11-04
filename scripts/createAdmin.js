// ============================================================
// Create (or promote) an Admin account  — FR-27
//
//   node scripts/createAdmin.js admin@nexcraft.com "Admin Name" "StrongPass123"
// ============================================================

require("dotenv").config();

const { connectDB, getDB } = require("../config/db");
const { hashPassword, validatePassword } = require("../utils/password");
const { generateUserId } = require("../utils/generateId");

async function main() {
    const [email, name, password] = process.argv.slice(2);

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedEmail || !normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        console.error('Usage: node scripts/createAdmin.js <valid-email> "<name>" [password]');
        process.exit(1);
    }

    await connectDB();
    const db = getDB();
    const now = new Date();

    const existing = await db.collection("users").findOne({ email: normalizedEmail });

    if (existing) {
        await db.collection("users").updateOne(
            { user_id: existing.user_id },
            {
                $addToSet: { roles: "Admin" },
                $set: { active_role: "Admin", updated_at: now }
            }
        );
        console.log(`Promoted ${normalizedEmail} to Admin. The existing password is unchanged.`);
    } else {
        const passwordError = validatePassword(password);
        if (passwordError) {
            console.error(passwordError);
            process.exit(1);
        }

        await db.collection("users").insertOne({
            user_id: generateUserId(),
            name: normalizedName,
            email: normalizedEmail,
            password: await hashPassword(password),
            email_verified: true,
            active_role: "Admin",
            roles: ["Admin"],
            status: "active",
            created_at: now,
            updated_at: now
        });
        console.log(`Created Admin ${normalizedEmail}`);
    }

    process.exit(0);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
