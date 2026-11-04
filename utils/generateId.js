const crypto = require("crypto");

function generateUserId() {
    return "USR-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

module.exports = {
    generateUserId
};
