export function formatAIComment(issueType, message, suggestion = "") {
    return `
### 🔍 AI Code Review - Issue: ${issueType}

🔹 **Issue:**  
${message}

${suggestion ? `🔹 **Suggested Fix:**\n\`${suggestion.replace(/`/g, "\\`")}\`` : ""}

✅ *Click below to accept or reject the fix.*  

🔧 **Apply Fix?**  
✔️ [Accept Fix](#) | ❌ [Reject Fix](#)
    `.trim();
}
