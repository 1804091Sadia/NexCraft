const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");
const messages = require("../controllers/messageController");

router.use(authenticateUser);

router.post("/", messages.sendMessage);
router.get("/", messages.listMessages);
router.get("/conversations", messages.listConversations);
router.get("/with/:user_id", messages.getThread);
router.patch("/:message_id/read", messages.markMessageRead);

module.exports = router;
