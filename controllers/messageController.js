// ============================================================
// DIRECT MESSAGING  (FR-26, FR-33, FR-34)
// ============================================================

const crypto = require("crypto");
const { getDB } = require("../config/db");
const { notify } = require("../utils/notify");
const { str } = require("../utils/constants");

function fail(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function serverError(res, label, error) {
    console.error(`${label}:`, error);
    return fail(res, 500, "Something went wrong. Please try again.");
}

const CONTEXT_TYPES = ["application", "enrollment"];


async function sendMessage(req, res) {
    try {
        const db = getDB();
        const senderId = req.user.user_id;
        const receiverId = str(req.body.receiver_id, 80);
        const body = str(req.body.body, 2000);
        const contextType = str(req.body.context_type, 20);
        const contextId = str(req.body.context_id, 80);

        if (!receiverId) return fail(res, 400, "Recipient is required");
        if (receiverId === senderId) return fail(res, 400, "You cannot message yourself");
        if (!body) return fail(res, 400, "Message cannot be empty");

        if (contextType && !CONTEXT_TYPES.includes(contextType)) {
            return fail(res, 400, "Invalid message context");
        }

        const [sender, receiver] = await Promise.all([
            db.collection("users").findOne({ user_id: senderId }),
            db.collection("users").findOne({ user_id: receiverId })
        ]);

        if (!receiver || receiver.status !== "active") {
            return fail(res, 404, "Recipient not found");
        }

        
        let contextLabel = "";
        if (contextType === "application" && contextId) {
            const application = await db.collection("applications").findOne({ application_id: contextId });
            const job = application && await db.collection("jobs").findOne({ job_id: application.job_id });
            const participants = [application?.user_id, job?.employer_id];
            if (!application || !participants.includes(senderId) || !participants.includes(receiverId)) {
                return fail(res, 400, "This application is not shared by both of you");
            }
            contextLabel = job.title;
        }

        if (contextType === "enrollment" && contextId) {
            const enrollment = await db.collection("enrollments").findOne({ enrollment_id: contextId });
            const program = enrollment && await db.collection("training_programs")
                .findOne({ program_id: enrollment.program_id });
            const participants = [enrollment?.user_id, program?.trainer_id];
            if (!enrollment || !participants.includes(senderId) || !participants.includes(receiverId)) {
                return fail(res, 400, "This enrollment is not shared by both of you");
            }
            contextLabel = program.title;
        }

        const message = {
            message_id: `MSG-${crypto.randomUUID()}`,
            sender_id: senderId,
            receiver_id: receiverId,
            body,
            context_type: contextType || null,
            context_id: contextType ? contextId : null,
            context_label: contextLabel || null,
            is_read: false,
            created_at: new Date()
        };

        await db.collection("messages").insertOne(message);
        delete message._id;

        // TC-MSG-01: notification for the receiver
        await notify(receiverId, "message", `New message from ${sender.name}`,
            body.length > 90 ? body.slice(0, 90) + "…" : body,
            `/messages.html?with=${encodeURIComponent(senderId)}`);

        return res.status(201).json({ success: true, message: "Message sent", data: message });

    } catch (error) {
        return serverError(res, "Send message error", error);
    }
}

// GET /api/messages/conversations — one row per person, newest first
async function listConversations(req, res) {
    try {
        const db = getDB();
        const me = req.user.user_id;

        const messages = await db.collection("messages")
            .find({ $or: [{ sender_id: me }, { receiver_id: me }] })
            .sort({ created_at: -1 })
            .limit(1000)
            .toArray();

        const conversations = new Map();

        for (const m of messages) {
            const other = m.sender_id === me ? m.receiver_id : m.sender_id;
            if (!conversations.has(other)) {
                conversations.set(other, {
                    user_id: other,
                    last_message: m.body,
                    last_from_me: m.sender_id === me,
                    last_at: m.created_at,
                    unread: 0
                });
            }
            if (m.receiver_id === me && !m.is_read) conversations.get(other).unread++;
        }

        const ids = [...conversations.keys()];
        const users = await db.collection("users")
            .find({ user_id: { $in: ids } })
            .project({ _id: 0, user_id: 1, name: 1, active_role: 1 })
            .toArray();
        const byId = Object.fromEntries(users.map(u => [u.user_id, u]));

        return res.json({
            success: true,
            unreadTotal: [...conversations.values()].reduce((sum, c) => sum + c.unread, 0),
            conversations: [...conversations.values()].map(c => ({
                ...c,
                name: byId[c.user_id]?.name || "Deleted user",
                role: byId[c.user_id]?.active_role || ""
            }))
        });

    } catch (error) {
        return serverError(res, "List conversations error", error);
    }
}

// GET /api/messages/with/:user_id — the thread; marks received messages read
async function getThread(req, res) {
    try {
        const db = getDB();
        const me = req.user.user_id;
        const other = str(req.params.user_id, 80);

        const otherUser = await db.collection("users").findOne(
            { user_id: other },
            { projection: { _id: 0, user_id: 1, name: 1, active_role: 1 } }
        );
        // A deleted account still shows the messages it sent you
        const shownUser = otherUser || { user_id: other, name: "Deleted user", active_role: "" };

        const messages = await db.collection("messages")
            .find({
                $or: [
                    { sender_id: me, receiver_id: other },
                    { sender_id: other, receiver_id: me }
                ]
            })
            .project({ _id: 0 })
            .sort({ created_at: 1 })
            .limit(500)
            .toArray();

        // TC-MSG-02: opening the thread marks received messages read
        await db.collection("messages").updateMany(
            { sender_id: other, receiver_id: me, is_read: false },
            { $set: { is_read: true, read_at: new Date() } }
        );

        return res.json({ success: true, user: shownUser, messages });

    } catch (error) {
        return serverError(res, "Get thread error", error);
    }
}

// GET /api/messages?box=inbox|sent&unread=true  (FR-34 list view)
async function listMessages(req, res) {
    try {
        const me = req.user.user_id;
        const box = req.query.box === "sent" ? "sent" : "inbox";
        const filter = box === "sent" ? { sender_id: me } : { receiver_id: me };
        if (box === "inbox" && req.query.unread === "true") filter.is_read = false;

        const messages = await getDB().collection("messages")
            .find(filter).project({ _id: 0 }).sort({ created_at: -1 }).limit(200).toArray();

        return res.json({ success: true, box, messages });

    } catch (error) {
        return serverError(res, "List messages error", error);
    }
}

// PATCH /api/messages/:message_id/read
async function markMessageRead(req, res) {
    try {
        const result = await getDB().collection("messages").updateOne(
            { message_id: str(req.params.message_id, 80), receiver_id: req.user.user_id },
            { $set: { is_read: true, read_at: new Date() } }
        );

        if (!result.matchedCount) return fail(res, 404, "Message not found");
        return res.json({ success: true, message: "Marked as read" });

    } catch (error) {
        return serverError(res, "Mark message read error", error);
    }
}

module.exports = {
    sendMessage,
    listConversations,
    getThread,
    listMessages,
    markMessageRead
};
