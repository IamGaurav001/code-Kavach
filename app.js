import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import crypto from "crypto";
import { githubWebhookHandler } from "./backend/controller/githubController.js";
import connectDB from "./backend/db.js";  // ✅ Ensure correct import

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Middleware: Verify GitHub Webhook Signature
function verifyGitHubSignature(req, res, next) {
    const secret = process.env.GITHUB_SECRET;
    
    if (!secret) {
        console.error("❌ GITHUB_SECRET is missing!");
        return res.status(500).send("Server misconfiguration");
    }

    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
        console.error("❌ No signature in request!");
        return res.status(400).send("Missing signature");
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(req.body));
    const digest = `sha256=${hmac.digest('hex')}`;

    if (signature !== digest) {
        console.error("❌ Webhook signature mismatch!");
        return res.status(403).send("Invalid signature");
    }

    console.log("✅ Webhook signature verified!");
    next();
}


// Webhook Endpoint (with verification)
app.post("/webhook", verifyGitHubSignature, githubWebhookHandler);

// Connect Database
connectDB().then(() => console.log("✅ Database Connected")).catch(err => console.error("❌ DB Connection Failed:", err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
