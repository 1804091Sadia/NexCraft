// ============================================================
// NEXCRAFT BACKEND SERVER
// Express + MongoDB (native driver) + JWT + bcryptjs
// ============================================================

require("dotenv").config();


// Some home ISPs fail MongoDB Atlas SRV lookups, so locally we use public
// DNS. Hosts like Vercel have working DNS, so the override is skipped there.
// Set FORCE_PUBLIC_DNS=false to turn it off anywhere.
const dns = require("dns");
if (!process.env.VERCEL && process.env.FORCE_PUBLIC_DNS !== "false") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const express = require("express");
const path = require("path");
const multer = require("multer");

const { connectDB } = require("./config/db");


["MONGO_URI", "DB_NAME", "JWT_SECRET"].forEach(name => {
    if (!process.env[name]) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
});

const app = express();
const PORT = process.env.PORT || 5000;


// ===============================
// MIDDLEWARE
// ===============================

app.disable("x-powered-by");

const isProduction = process.env.NODE_ENV === "production";

// Behind a host's proxy (Render, Railway, Vercel, Nginx) req.ip and
// req.secure must come from the proxy headers, or every visitor looks
// like the same IP to the login rate limiter.
if (isProduction || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}

app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Only same-site resources. 'unsafe-inline' is needed until the
    // inline onclick="..." handlers in older pages are moved into .js files.
    res.set("Content-Security-Policy", [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join("; "));
    if (isProduction) {
        res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "same-origin");
    next();
});

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});


// ===============================
// STATIC FILES
// ===============================

app.use(express.static(path.join(__dirname, "public"), {
    // Browsers re-check HTML every visit; CSS/JS/images are cached for an hour
    setHeaders(res, filePath) {
        res.setHeader("Cache-Control", filePath.endsWith(".html") || filePath.endsWith("sw.js")
            ? "no-cache"
            : `public, max-age=${isProduction ? 3600 : 0}`);
    }
}));

// Profile photos are public (shown on the graduate showcase).
app.use("/uploads/profile", express.static(path.join(__dirname, "uploads", "profile")));


// ===============================
// API ROUTES
// ===============================

// Every API request waits for the database connection (needed on Vercel,
// where the app starts on demand). After the first request this is instant.
app.use("/api", (req, res, next) => {
    connectDB().then(() => next(), () => res.status(503).json({
        success: false,
        message: "The service is temporarily unavailable. Please try again in a minute."
    }));
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/learners", require("./routes/learnerRoutes"));
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use("/api/applications", require("./routes/applicationRoutes"));
app.use("/api/saved-jobs", require("./routes/savedJobRoutes"));
app.use("/api/training", require("./routes/trainingRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
app.use("/api/showcase", require("./routes/showcaseRoutes"));
app.use("/api/badges", require("./routes/badgeRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/trainer-conversion", require("./routes/trainerConversionRoutes"));
app.use("/api/employers", require("./routes/employerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api", require("./routes/miscRoutes"));


app.use("/api/trainers/programs", require("./routes/trainerProgramRoutes"));
app.use("/api/trainers/enrollments", require("./routes/trainerEnrollmentRoutes"));
app.use("/api/trainers/stats", require("./routes/trainerStatsRoutes"));
app.use("/api/trainers", require("./routes/trainerRoutes"));

app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "NexCraft API is working" });
});


// ===============================
// 404 FOR UNKNOWN API ROUTES
// ===============================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});


// ===============================
// GLOBAL ERROR HANDLER
// ===============================


app.use((err, req, res, next) => {

    // Upload errors -> clear 400 messages (TC-SEC-01)
    if (err instanceof multer.MulterError) {
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "File is too large. Maximum size is 4 MB."
            : `Upload error: ${err.message}`;
        return res.status(400).json({ success: false, message });
    }

    if (err && /must be|Invalid upload field|Invalid file type/.test(err.message)) {
        return res.status(400).json({ success: false, message: err.message });
    }

    // Malformed JSON body
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Invalid JSON in request body" });
    }

    console.error("Unhandled error:", err);

    res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again."
    });
});


// ===============================
// START SERVER
// ===============================

async function startServer() {
    try {
        await connectDB();
    } catch (error) {
        process.exit(1); // locally: stop with the error shown above
    }

    app.listen(PORT, () => {
        console.log(`NexCraft server running on http://localhost:${PORT}`);
    });
}

// Warn about settings that break a public launch
function checkLaunchSettings() {
    const warnings = [];
    const { emailMode } = require("./utils/email");

    if ((process.env.JWT_SECRET || "").length < 48) {
        warnings.push("JWT_SECRET is shorter than 48 characters — generate a long random one.");
    }
    if (/localhost|127\.0\.0\.1/.test(process.env.BASE_URL || "")) {
        warnings.push("BASE_URL points to localhost — email links will not work for users.");
    }
    if (emailMode() === "console") {
        warnings.push("No email provider set — password reset and verification emails are only printed here.");
    }
    if (process.env.EMAIL_VERIFICATION_ENABLED !== "true") {
        warnings.push("EMAIL_VERIFICATION_ENABLED is not true — the SRS (FR-01) requires verification.");
    }

    const label = isProduction ? "LAUNCH WARNING" : "note";
    warnings.forEach(w => console.warn(`[${label}] ${w}`));
}

process.on("unhandledRejection", error => {
    console.error("Unhandled promise rejection:", error);
});

checkLaunchSettings();

// Locally (`npm start` / `npm run dev`) start a normal server.
// On Vercel the exported app below is used and no port is opened.
if (require.main === module && !process.env.VERCEL) {
    startServer();
}

// Exported for hosts that import the app (e.g. Vercel) and for tests
module.exports = app;
