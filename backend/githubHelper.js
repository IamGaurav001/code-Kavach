import axios from "axios";


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

export async function getLatestCommitSHA(repoFullName, prNumber) {
    try {
        const githubToken = process.env.GITHUB_TOKEN;

        const response = await axios.get(
            `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/commits`,
            { headers: { Authorization: `token ${githubToken}` } }
        );

        if (!response.data || response.data.length === 0) {
            throw new Error("No commits found for this PR.");
        }

        const latestCommit = response.data[response.data.length - 1];
        return latestCommit.sha;

    } catch (error) {
        console.error("❌ Error Fetching Commit SHA:", error.response?.data || error.message);
        return null;
    }
}
