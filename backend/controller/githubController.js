import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";
import { analyzeCode } from "../utils/aiHelper.js";
import { getLatestCommitSHA } from "../githubHelper.js"; 
import { savePRReview } from "../dbController.js"; 

dotenv.config();


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
      // ✅ Fetch PR diff
      const repoFullName = pr.base.repo.full_name;
      const prNumber = pr.number;
      const githubToken = process.env.GITHUB_TOKEN;

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

      const commitSHA = await getLatestCommitSHA(repoFullName, pr.head.ref);
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



async function acceptFix(repoFullName, prNumber, fixes) {
    const githubToken = process.env.GITHUB_TOKEN;
    const branch = "fix-ai-suggestions";
    const commitMessage = "🤖 Auto-fix suggested by AI Review Bot";

    try {
        for (const fix of fixes) {
            const { filename, lineNumber, fixContent } = fix;

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

            console.log(`✅ Fix Applied to ${filename}: ${commitMessage}`);
        }
    } catch (error) {
        console.error("❌ Error Applying Fix:", error.response?.data || error.message);
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
            side: "RIGHT"
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


export async function postSummaryComment(owner, repo, prNumber, reviewComments) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        const summary = `### 🤖 AI Review Summary\n\n${reviewComments.map(c => 
            `- **${c.issue}** (File: \`${c.path}\`, Line ${c.line})\n  - 💡 Suggestion: ${c.suggestion}`
        ).join("\n\n")}`;

        const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

        await axios.post(url, { body: summary }, 
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        console.log("✅ Summary Comment Posted Successfully!");
    } catch (error) {
        console.error("❌ Error Posting Summary Comment:", error.response?.data || error.message);
    }
}
