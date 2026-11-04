// ============================================================
// UPLOADS (TC-SEC-01)
// 1. multer keeps the file in memory (max 4 MB — fits Vercel's 4.5 MB limit)
// 2. we check the declared type AND the real file content
// 3. the file is saved in MongoDB GridFS (survives restarts on any host)
//
// After this middleware, each accepted file has:
//   file.storedRef  -> "/api/files/photo/<id>" (photo) or "gridfs:<id>" (CV)
// Routes keep using upload.fields([...]) and upload.single("...").
// ============================================================

const multer = require("multer");
const { contentMatchesType, saveFile } = require("../utils/fileStore");

const MAX_BYTES = 4 * 1024 * 1024;

const RULES = {
    profile_image: {
        types: ["image/jpeg", "image/png", "image/jpg"],
        message: "Profile image must be a JPG or PNG file",
        kind: "photo"
    },
    cv: {
        types: ["application/pdf"],
        message: "CV must be a PDF file",
        kind: "cv"
    }
};

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 2 },
    fileFilter(req, file, cb) {
        const rule = RULES[file.fieldname];
        if (!rule) return cb(new Error("Invalid upload field"));
        if (!rule.types.includes(file.mimetype)) return cb(new Error(rule.message));
        cb(null, true);
    }
});

function allFiles(req) {
    if (req.file) return [req.file];
    if (req.files) return Object.values(req.files).flat();
    return [];
}

// Runs after multer: verify content, then save to GridFS
async function storeFiles(req, res, next) {
    try {
        for (const file of allFiles(req)) {
            const rule = RULES[file.fieldname];

            if (!contentMatchesType(file.buffer, file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: `${rule.message}. The file content does not match its type.`
                });
            }

            const extension = file.mimetype === "application/pdf" ? ".pdf"
                : file.mimetype === "image/png" ? ".png" : ".jpg";

            const id = await saveFile(file.buffer, {
                filename: `${req.user.user_id}_${rule.kind}${extension}`,
                contentType: file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype,
                ownerId: req.user.user_id,
                kind: rule.kind
            });

            file.storedRef = rule.kind === "photo" ? `/api/files/photo/${id}` : `gridfs:${id}`;
            file.buffer = null; // free memory
        }

        next();

    } catch (error) {
        next(error);
    }
}

module.exports = {
    fields: spec => [memoryUpload.fields(spec), storeFiles],
    single: name => [memoryUpload.single(name), storeFiles],
    MAX_BYTES
};
