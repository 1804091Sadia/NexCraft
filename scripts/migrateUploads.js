// ============================================================
// Move existing uploads from ./uploads (disk) into MongoDB GridFS.
// Run ONCE, on your computer, before deploying:
//
//   node scripts/migrateUploads.js
//
// Safe to run again: profiles already pointing to GridFS are skipped.
// The files on disk are not deleted; remove ./uploads yourself afterwards.
// ============================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { connectDB, getDB } = require("../config/db");
const { saveFile, contentMatchesType } = require("../utils/fileStore");

const ROOT = path.join(__dirname, "..");

const TYPES = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function moveOne(ref, ownerId, kind) {
    if (typeof ref !== "string" || !ref.startsWith("/uploads/")) return null;

    const filePath = path.join(ROOT, "uploads", kind === "cv" ? "cv" : "profile", path.basename(ref));
    if (!fs.existsSync(filePath)) {
        console.log(`  missing on disk: ${ref}`);
        return null;
    }

    const contentType = TYPES[path.extname(filePath).toLowerCase()];
    const buffer = fs.readFileSync(filePath);

    if (!contentType || !contentMatchesType(buffer, contentType)) {
        console.log(`  skipped (content is not a real ${contentType || "known type"}): ${ref}`);
        return null;
    }

    const id = await saveFile(buffer, {
        filename: path.basename(filePath), contentType, ownerId, kind
    });

    return kind === "photo" ? `/api/files/photo/${id}` : `gridfs:${id}`;
}

async function main() {
    await connectDB();
    const db = getDB();
    let moved = 0;

    for (const collection of ["learner_profiles", "trainer_profiles"]) {
        const profiles = await db.collection(collection)
            .find({ $or: [{ profile_image: /^\/uploads\// }, { cv: /^\/uploads\// }] })
            .toArray();

        for (const profile of profiles) {
            const update = {};

            const photo = await moveOne(profile.profile_image, profile.user_id, "photo");
            if (photo) update.profile_image = photo;

            if (collection === "learner_profiles") {
                const cv = await moveOne(profile.cv, profile.user_id, "cv");
                if (cv) {
                    update.cv = cv;
                    // Applications copied the old CV path; point them to the new file
                    await db.collection("applications").updateMany(
                        { user_id: profile.user_id, cv: profile.cv },
                        { $set: { cv } }
                    );
                }
            }

            if (Object.keys(update).length) {
                await db.collection(collection).updateOne({ _id: profile._id }, { $set: update });
                moved += Object.keys(update).length;
                console.log(`  ${collection}: ${profile.user_id} -> ${Object.keys(update).join(", ")}`);
            }
        }
    }

    console.log(`\nDone. ${moved} file(s) moved into MongoDB.`);
    process.exit(0);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
