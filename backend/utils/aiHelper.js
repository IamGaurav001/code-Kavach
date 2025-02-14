import { GoogleGenerativeAI } from "@google/generative-ai";
import { formatAIComment } from "../utils/formatAIComment.js";
import axios from "axios";

import dotenv from "dotenv";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


async function analyzeCode(codeDiff) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        

        const cleanedCode = codeDiff
            .split("\n")
            .filter(line => !line.startsWith("diff") && !line.startsWith("@@")) // Remove metadata lines
            .join("\n");

        const prompt = `
You are an AI code reviewer. Analyze the following Git diff and provide code review suggestions.
For each suggestion, include:
1. Issue description
2. Suggested fix
3. File path
4. Line number

Return your response as a JSON array.

Git Diff:
\`\`\`
${diffData}
\`\`\`
`;


        const response = await model.generateContent(prompt);
        console.log("🔍 RAW AI RESPONSE:", JSON.stringify(response, null, 2));
        let aiResponse = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!aiResponse) {
            console.warn("⚠️ Gemini returned an empty response.");
            return [];
        }

        try {
            // ✅ Remove Markdown like ```json
            const cleanedResponse = aiResponse.replace(/```json|```/gi, "").trim();
        
            // ✅ Extract valid JSON
            const jsonStartIndex = cleanedResponse.indexOf("[");
            const jsonEndIndex = cleanedResponse.lastIndexOf("]");
        
            if (jsonStartIndex >= 0 && jsonEndIndex >= 0) {
                aiResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
            }
        
            // ✅ Parse JSON safely
            let parsedData = JSON.parse(aiResponse);
        
            // ✅ Ensure suggestions are always present
            parsedData = parsedData.map(comment => ({
                ...comment,
                suggestion: comment.suggestion || "No suggestion provided."
            }));
        
            return parsedData;
        } catch (jsonError) {
            console.warn("⚠️ JSON parsing failed:", jsonError.message);
            return [];
        }
        

        console.warn("⚠️ Gemini response is not valid JSON. Returning an empty array.");
        return [];

    } catch (error) {
        console.error("❌ Gemini API Error:", error.message || error);
        return [];
    }
}




export { analyzeCode, formatAIComment };
