// ============================================================
// FILE STORE — uploads live inside MongoDB (GridFS), not on disk.
//
// Why: free hosting (Render free, Vercel) has no permanent disk.
// Files written to ./uploads disappear on every restart/redeploy.
// GridFS is part of the official MongoDB driver, so no extra package.
//
// Stored references:
//   profile photos -> "/api/files/photo/<id>"   (public URL)
//   CVs            -> "gridfs:<id>"              (private, see fileController)
// ============================================================

const { GridFSBucket, ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const BUCKET = "uploads";

function bucket() {
    return new GridFSBucket(getDB(), { bucketName: BUCKET });
}

// Check the first bytes of the file, not the browser's claimed type
// (OWASP File Upload Cheat Sheet: Content-Type can be spoofed).
const SIGNATURES = {
    "application/pdf": buf => buf.slice(0, 5).toString("latin1") === "%PDF-",
    "image/png": buf => buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": buf => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    "image/jpg": buf => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
};

function contentMatchesType(buffer, mimetype) {
    const check = SIGNATURES[mimetype];
    return Boolean(check && buffer && buffer.length > 8 && check(buffer));
}

/**
 * Save a file buffer. Returns the new file id (string).
 * @param {Buffer} buffer
 * @param {{ filename: string, contentType: string, ownerId: string, kind: "photo"|"cv" }} meta
 */
function saveFile(buffer, { filename, contentType, ownerId, kind }) {
    return new Promise((resolve, reject) => {
        const upload = bucket().openUploadStream(filename, {
            metadata: { contentType, ownerId, kind, uploadedAt: new Date() }
        });

        upload.once("error", reject);
        upload.once("finish", () => resolve(String(upload.id)));
        upload.end(buffer);
    });
}

async function findFile(id) {
    if (!ObjectId.isValid(id)) return null;
    return getDB().collection(`${BUCKET}.files`).findOne({ _id: new ObjectId(id) });
}

function openDownload(id) {
    return bucket().openDownloadStream(new ObjectId(id));
}

async function deleteFile(id) {
    if (!id || !ObjectId.isValid(id)) return;
    try {
        await bucket().delete(new ObjectId(id));
    } catch {
        // Already gone — nothing to do
    }
}

// "/api/files/photo/<id>" or "gridfs:<id>" -> "<id>", anything else -> null
function idFromRef(ref) {
    if (typeof ref !== "string") return null;
    const match = ref.match(/^(?:gridfs:|\/api\/files\/photo\/)([a-f0-9]{24})$/i);
    return match ? match[1] : null;
}

module.exports = {
    contentMatchesType,
    saveFile,
    findFile,
    openDownload,
    deleteFile,
    idFromRef
};
