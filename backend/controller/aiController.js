import { formatAIComment, analyzeCode } from "../utils/aiHelper.js";
import axios from "axios";


async function analyzePullRequest(prNumber, repoOwner, repoName, token) {
    try {
        const diffUrl = `https://github.com/${repoOwner}/${repoName}/pulls/${prNumber}.diff`;
        const headers = { Authorization: `Bearer ${token}` };
        
        const { data: diff } = await axios.get(diffUrl, { headers });

        if (!diff) {
            console.warn("⚠️ Empty diff received.");
            return "No changes detected in the PR.";
        }

        // 🔥 Call AI model for code review
        const aiFeedback = await analyzeCode(diff);
        return formatAIComment("AI Code Review", aiFeedback);
        
    } catch (error) {
        console.error("❌ Error analyzing PR:", error.response?.data || error.message);
        return "AI review failed due to an error.";
    }
}

export { analyzePullRequest };
