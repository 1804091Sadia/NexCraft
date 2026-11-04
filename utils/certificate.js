// ============================================================
// CERTIFICATE ISSUING  (FR-45)
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");

async function issueCertificate(enrollment) {
    const db = getDB();

    const existing = await db.collection("certificates").findOne({
        enrollment_id: enrollment.enrollment_id
    });

    if (existing) {
        return existing;
    }

    const now = new Date();

    const certificate = {
        certificate_id: `CERT-${crypto.randomUUID()}`,
        certificate_number:
            `NC-${now.getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        user_id: enrollment.user_id,
        enrollment_id: enrollment.enrollment_id,
        program_id: enrollment.program_id,
        issued_at: now,          
        completion_date: now,    
        isShowcased: true,       // FR-45: shown by default
        created_at: now
    };

    await db.collection("certificates").insertOne(certificate);

    return certificate;
}

module.exports = { issueCertificate };
