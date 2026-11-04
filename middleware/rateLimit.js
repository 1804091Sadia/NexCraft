// ============================================================
// FR-02: "Failed attempts are rate-limited."
// ============================================================

function createRateLimiter({ windowMs, max, message, keyFn, countOnlyFailures = false }) {
    const hits = new Map();

    
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, 60 * 1000).unref();

    return function rateLimit(req, res, next) {
        const key = keyFn ? keyFn(req) : req.ip;
        const now = Date.now();

        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        if (entry.count >= max) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            res.set("Retry-After", String(retryAfterSec));

            return res.status(429).json({
                success: false,
                message: message ||
                    `Too many attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`
            });
        }

        entry.count++;

        if (countOnlyFailures) {
            res.on("finish", () => {
                if (res.statusCode < 400 && entry.count > 0) entry.count--;
            });
        }

        next();
    };
}

// 5 FAILED login attempts per 15 minutes per IP + email
// Defaults suit a public site; a test server can raise them in .env
const envNumber = (name, fallback) => {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: envNumber("RATE_LIMIT_LOGIN_MAX", 5),
    countOnlyFailures: true,
    keyFn: req =>
        req.ip + "|" + String(req.body?.email || "").trim().toLowerCase()
});

// Email-sending endpoints (register, resend, forgot): 10 per 15 min per IP.
const emailLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: envNumber("RATE_LIMIT_EMAIL_MAX", 10)
});

module.exports = {
    createRateLimiter,
    loginLimiter,
    emailLimiter
};
