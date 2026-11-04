const express = require("express");
const router = express.Router();

const authenticateUser = require("../middleware/authMiddleware");

const {
    getNotifications,
    markRead,
    markAllRead
} = require("../controllers/notificationController");

router.use(authenticateUser);

router.get("/", getNotifications);

// "read-all" must be declared before "/:id/read"
router.patch("/read-all", markAllRead);

router.patch("/:id/read", markRead);

module.exports = router;
