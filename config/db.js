const { MongoClient } = require("mongodb");
require("dotenv").config();

let client;
let db;
let connecting = null;

// Connect once and reuse the connection.
// Safe to call many times: later calls wait for the same connection.
// On Vercel the app starts on demand, so API requests call this first
// (see index.js) instead of relying on a connection made at startup.
function connectDB() {
    if (db) return Promise.resolve(db);
    if (connecting) return connecting;

    if (!process.env.MONGO_URI || !process.env.DB_NAME) {
        const error = new Error("MONGO_URI and DB_NAME must be set (see .env.example)");
        console.error(error.message);
        return Promise.reject(error);
    }

    connecting = (async () => {
        client = new MongoClient(process.env.MONGO_URI, {
            // Fail fast with a clear error instead of hanging for 30 s
            serverSelectionTimeoutMS: 10000
        });
        await client.connect();
        db = client.db(process.env.DB_NAME);
        console.log("MongoDB connected successfully");
        return db;
    })().catch(error => {
        connecting = null; // allow a retry on the next request
        console.error("MongoDB connection failed:", error.message);
        throw error;
    });

    return connecting;
}

function getDB() {
    if (!db) {
        throw new Error("Database is not connected");
    }

    return db;
}

module.exports = {
    connectDB,
    getDB
};
