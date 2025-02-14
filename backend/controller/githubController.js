import crypto from "crypto";
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { analyzeCode } from "../utils/aiHelper.js";
import { getLatestCommitSHA } from "../githubHelper.js"; // Ensure correct import path
import { savePRReview } from "../dbController.js";
const app = express();

dotenv.config();
app.use(express.json()); 


export function githubWebhookHandler(req, res) {
    const signature = `sha256=${crypto
        .createHmac("sha256", process.env.GITHUB_SECRET)
        .update(JSON.stringify(req.body))
        .digest("hex")}`;

    if (req.headers["x-hub-signature-256"] !== signature) {
        return res.status(401).send("Unauthorized");
    }

    const { action, pull_request } = req.body;

    if (!pull_request) {
        console.error("❌ Error: No pull request data received in webhook!");
        return res.status(400).send("Bad Request: Missing pull request data.");
    }

    console.log("🔍 Debug: Webhook Received for PR:", pull_request.number);

    if (action === "opened" || action === "synchronize") {
        processPR(pull_request);
    }

    res.sendStatus(200);
}

/**
 * Process Pull Request
 */
async function processPR(pr) {
    try {
        if (!pr || !pr.number) {
            throw new Error("❌ PR Object is invalid! Check webhook payload.");
        }

        const repoFullName = pr.base.repo.full_name;
        const prNumber = pr.number;
        const githubToken = process.env.GITHUB_TOKEN;

        console.log("🔍 Debug: PR Number:", prNumber);
        console.log("🔍 Debug: PR Head Ref:", pr.head.ref);

        const response = await axios.get(
            `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`,
            {
                headers: {
                    Authorization: `token ${githubToken}`,
                    Accept: "application/vnd.github.v3.diff",
                },
            }
        );

        if (!response || !response.data) {
            throw new Error("❌ GitHub API returned an invalid response.");
        }

        let diffData = response.data;
        console.log("✅ Full Raw Diff Data:\n", diffData);

        diffData = diffData.replace(/\r/g, "").trim();

        if (!diffData.includes("diff --git")) {
            throw new Error("❌ PR Diff Data is invalid or malformed.");
        }

        const reviewComments = await analyzeCode(diffData);
        console.log("✅ AI Review Generated:", reviewComments);

        await savePRReview(prNumber, repoFullName, reviewComments);

        const commitSHA = await getLatestCommitSHA(repoFullName, pr.head.ref, prNumber);
        if (!commitSHA) {
            throw new Error("❌ Unable to fetch latest commit SHA!");
        }

        for (const comment of reviewComments) {
            await postInlineComment(
                pr.base.repo.owner.login,
                pr.base.repo.name,
                prNumber,
                comment.path,
                comment.line,
                commitSHA,
                comment.issue
            );
        }
    } catch (error) {
        console.error("❌ Error Processing PR:", error.response?.data || error.message);
    }
}



export async function postInlineComment(owner, repo, prNumber, filePath, line, commitSHA, comment) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        if (!commitSHA) {
            throw new Error("❌ commitSHA is missing! Cannot post inline comment.");
        }

        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`;

        console.log(`📌 Posting comment at ${filePath}, Line ${line}, Commit ${commitSHA}`);

        const payload = {
            body: comment,
            path: filePath,
            line: line,
            commit_id: commitSHA,
            side: "RIGHT",
        };

        const headers = {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
        };

        const response = await axios.post(url, payload, { headers });

        console.log("✅ Inline Comment Posted Successfully!", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error Posting Inline Comment:", error.response?.data || error.message);
    }
}

export async function postSummaryComment(owner, repo, prNumber, reviewComments) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        const summary = `### 🤖 AI Review Summary\n\n${reviewComments
            .map(
                (c) =>
                    `- **${c.issue}** (File: \`${c.path}\`, Line ${c.line})\n  - 💡 Suggestion: ${c.suggestion}`
            )
            .join("\n\n")}`;

        const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

        await axios.post(url, { body: summary }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });

        console.log("✅ Summary Comment Posted Successfully!");
    } catch (error) {
        console.error("❌ Error Posting Summary Comment:", error.response?.data || error.message);
    }
}
