import axios from "axios";

/**
 * Applies an AI-generated fix to a file in a GitHub Pull Request.
 *
 * @param {string} repoOwner - GitHub repository owner.
 * @param {string} repoName - GitHub repository name.
 * @param {number} prNumber - Pull Request number.
 * @param {string} filePath - Path of the file to modify.
 * @param {string} newCode - Updated code content.
 */
export async function applyFixToPR(repoOwner, repoName, prNumber, filePath, newCode) {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        console.error("❌ GITHUB_TOKEN is missing. Please check your environment variables.");
        return;
    }

    try {
        const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
        const headers = { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" };

        // Fetch current file details
        const { data: fileData } = await axios.get(fileUrl, { headers });

        if (!fileData.sha) {
            console.error("❌ File SHA not found. Cannot update file.");
            return;
        }

        const updatedContent = Buffer.from(newCode, "utf-8").toString("base64");

        // Create a commit with the AI-generated fix
        await axios.put(
            fileUrl,
            {
                message: `🤖 AI Fix Applied (PR #${prNumber})`,
                content: updatedContent,
                sha: fileData.sha, // Required for updating the file
            },
            { headers }
        );

        console.log(`✅ AI Fix Applied to ${filePath} in PR #${prNumber}`);
    } catch (error) {
        console.error("❌ Error Applying Fix:", error.response?.data || error.message);
    }
}

/**
 * Fetches the latest commit SHA for a given PR.
 *
 * @param {string} repoFullName - GitHub repository full name (e.g., "owner/repo").
 * @param {number} prNumber - Pull Request number.
 * @returns {Promise<string | null>} - Latest commit SHA or null if failed.
 */
export async function getLatestCommitSHA(repoFullName, prNumber) {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        console.error("❌ GITHUB_TOKEN is missing. Please check your environment variables.");
        return null;
    }

    const apiUrl = `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/commits`;

    try {
        const { data: commits } = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${githubToken}` },
        });

        if (!commits.length) {
            console.warn("⚠️ No commits found for the given PR.");
            return null;
        }

        const latestCommitSHA = commits[commits.length - 1].sha;
        console.log(`✅ Latest Commit SHA for PR #${prNumber}: ${latestCommitSHA}`);
        return latestCommitSHA;
    } catch (error) {
        console.error("❌ Error Fetching Commit SHA:", error.response?.data || error.message);
        return null;
    }
}
