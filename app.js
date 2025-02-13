import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import crypto from "crypto";
import { githubWebhookHandler } from "./backend/controller/githubController.js";
import connectDB from "./backend/db.js";  // ✅ Ensure correct import

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Middleware: Verify GitHub Webhook Signature
function verifyGitHubSignature(req, res, next) {
    const signature = req.headers["x-hub-signature-256"];
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
    hmac.update(payload);
    const expectedSignature = `sha256=${hmac.digest("hex")}`;

    if (signature !== expectedSignature) {
        return res.status(401).send("❌ Invalid webhook signature.");
    }
    next();
}

// Webhook Endpoint (with verification)
app.post("/webhook", verifyGitHubSignature, githubWebhookHandler);

// Connect Database
connectDB().then(() => console.log("✅ Database Connected")).catch(err => console.error("❌ DB Connection Failed:", err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
