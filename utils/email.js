const nodemailer = require("nodemailer");

// ------------------------------------------------------------
// Three ways to send email, picked automatically from .env:
//
// 1. BREVO_API_KEY set  -> Brevo HTTPS API (works on hosts that block
//                          SMTP ports, e.g. Render free; 300 emails/day free)
// 2. EMAIL_USER + EMAIL_PASSWORD set -> Gmail SMTP (good for local use)
// 3. Neither            -> the link is printed in the server console
//
// EMAIL_FROM is the sender shown to users (must be a verified sender
// in Brevo, or your Gmail address).
// ------------------------------------------------------------

const brevoKey = process.env.BREVO_API_KEY;
const smtpConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
const sender = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";

const transporter = !brevoKey && smtpConfigured
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    })
    : null;

function emailMode() {
    if (brevoKey) return "brevo";
    if (transporter) return "smtp";
    return "console";
}

async function sendWithBrevo(message) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": brevoKey,
            "content-type": "application/json",
            accept: "application/json"
        },
        body: JSON.stringify({
            sender: { email: sender, name: "NexCraft" },
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html
        })
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Brevo email failed (${response.status}): ${detail.slice(0, 200)}`);
    }
}

async function deliver(message, link) {
    const mode = emailMode();

    if (mode === "console") {
        console.log(`[email disabled] To: ${message.to} | ${message.subject}\n  Link: ${link}`);
        return;
    }

    if (mode === "brevo") {
        await sendWithBrevo(message);
        return;
    }

    await transporter.sendMail({ ...message, from: sender });
}


// ===============================
// SEND VERIFICATION EMAIL
// ===============================

async function sendVerificationEmail(email, token) {

    const verificationLink =
        `${process.env.BASE_URL}/verify-email.html?token=${token}`;

    await deliver({
        from: process.env.EMAIL_USER,

        to: email,

        subject: "NexCraft - Verify Your Email",

        html: `
            <h2>Welcome to NexCraft</h2>

            <p>
                Please verify your email address
                by clicking the button below.
            </p>

            <p>
                <a href="${verificationLink}"
                   style="
                   display:inline-block;
                   padding:10px 20px;
                   background:#007bff;
                   color:white;
                   text-decoration:none;
                   border-radius:5px;">
                   Verify Email
                </a>
            </p>

            <p>
                This verification link is valid for 24 hours.
            </p>

            <p>
                If you did not create this account,
                you can ignore this email.
            </p>
        `
    }, verificationLink);
}


// ===============================
// SEND PASSWORD RESET EMAIL
// ===============================

async function sendPasswordResetEmail(email, token) {

    const resetLink =
        `${process.env.BASE_URL}/reset-password.html?token=${token}`;

    await deliver({
        from: process.env.EMAIL_USER,

        to: email,

        subject: "NexCraft - Reset Your Password",

        html: `
            <h2>Password Reset</h2>

            <p>
                We received a request to reset
                your NexCraft password.
            </p>

            <p>
                <a href="${resetLink}"
                   style="
                   display:inline-block;
                   padding:10px 20px;
                   background:#007bff;
                   color:white;
                   text-decoration:none;
                   border-radius:5px;">
                   Reset Password
                </a>
            </p>

            <p>
                This link will expire in 15 minutes.
            </p>

            <p>
                If you did not request a password reset,
                you can safely ignore this email.
            </p>
        `
    }, resetLink);
}


module.exports = {
    emailMode,
    sendVerificationEmail,
    sendPasswordResetEmail
};