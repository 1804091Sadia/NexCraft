const bcrypt = require("bcryptjs");

async function hashPassword(password) {
    return await bcrypt.hash(password, 12);
}

async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}


//  FR-36: "a new password that meets complexity rules".

function validatePassword(password) {
    if (typeof password !== "string" || password.length < 8) {
        return "Password must contain at least 8 characters";
    }

    // bcrypt only uses the first 72 bytes
    if (Buffer.byteLength(password, "utf8") > 72) {
        return "Password must be 72 characters or fewer";
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain at least one letter and one number";
    }

    return null;
}

module.exports = {
    hashPassword,
    comparePassword,
    validatePassword
};
