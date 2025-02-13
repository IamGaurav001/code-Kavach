import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";
import { analyzeCode } from "../utils/aiHelper.js";
import { getLatestCommitSHA } from "../githubHelper.js";
import { savePRReview } from "../dbController.js"; // ✅ Import database function

dotenv.config();

/*
 * GitHub Webhook Handler
 */
export function githubWebhookHandler(req, res) {
    const signature = `sha256=${crypto
        .createHmac("sha256", process.env.GITHUB_SECRET)
        .update(JSON.stringify(req.body))
        .digest("hex")}`;

    if (req.headers["x-hub-signature-256"] !== signature) {
        return res.status(401).send("Unauthorized");
    }

    const { action, pull_request } = req.body;
    if (action === "opened" || action === "synchronize") {
        processPR(pull_request);
    }
    res.sendStatus(200);
}

/**
 * Process Pull Request
 */
async function processPR(pr) {
    console.log(`🔹 Processing PR: #${pr.number} in ${pr.base.repo.full_name}`);
    
    try {
        const { data: diffData } = await axios.get(pr.diff_url);
        console.log("✅ Diff Fetched Successfully");

        const reviewComments = await analyzeCode(diffData);

        if (!Array.isArray(reviewComments)) {
            throw new Error("❌ Invalid response: reviewComments is not an array.");
        }

        // ✅ Save PR review in MongoDB
        await savePRReview(pr.number, pr.base.repo.full_name, reviewComments);

        // ✅ Post inline comments
        for (const comment of reviewComments) {
            if (!comment.line || !comment.issue || !comment.suggestion || !comment.filePath) {
                console.error("❌ Skipping invalid comment data:", comment);
                continue;
            }

            await postInlineComment(
                pr.base.repo.owner.login,
                pr.base.repo.name,
                pr.number,
                comment.filePath,  // ✅ Ensure file path is provided
                comment.line,
                comment.issue + "\n\n💡 Suggested Fix:\n" + comment.suggestion
            );
        }

    } catch (error) {
        console.error("❌ Error Processing PR:", error.response?.data || error.message);
    }
}

/**
 * Apply AI-Suggested Fix
 */
async function acceptFix(repoFullName, prNumber, filename, lineNumber, fixContent) {
    const githubToken = process.env.GITHUB_TOKEN;
    const branch = "fix-ai-suggestions";
    const commitMessage = "🤖 Auto-fix suggested by AI Review Bot";

    try {
        const { data: file } = await axios.get(
            `https://api.github.com/repos/${repoFullName}/contents/${filename}`,
            { headers: { Authorization: `token ${githubToken}` } }
        );

        const content = Buffer.from(file.content, 'base64').toString('utf8').split("\n");
        content[lineNumber - 1] = fixContent;
        const newContent = Buffer.from(content.join("\n")).toString('base64');

        await axios.put(
            `https://api.github.com/repos/${repoFullName}/contents/${filename}`,
            {
                message: commitMessage,
                content: newContent,
                sha: file.sha,
                branch,
            },
            { headers: { Authorization: `token ${githubToken}` } }
        );

        console.log(`✅ Fix Applied Automatically: ${commitMessage}`);
    } catch (error) {
        console.error("❌ Error Applying Fix:", error.response?.data || error.message);
    }
}

/**
 * Post Inline Comment on PR
 */
export async function postInlineComment(owner, repo, prNumber, filePath, line, comment) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`;
        
        const payload = {
            body: comment,
            path: filePath,   // ✅ Ensure path is a valid file string (e.g., "src/index.js")
            line: line,       // ✅ Ensure line is an integer (code line number)
            side: "RIGHT"     // ✅ Required for PR review comments
        };

        const headers = {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json"
        };

        const response = await axios.post(url, payload, { headers });

        console.log("✅ Inline Comment Posted Successfully!", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error Posting Inline Comment:", error.response?.data || error.message);
    }
}
