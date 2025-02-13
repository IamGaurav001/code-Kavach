import { GoogleGenerativeAI } from "@google/generative-ai";
import { formatAIComment } from "../utils/formatAIComment.js";
import dotenv from "dotenv";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyze GitHub PR code diff using Gemini AI.
 * @param {string} codeDiff - The raw GitHub diff data.
 * @returns {Array} - Array of objects containing issues, suggestions, and file details.
 */
async function analyzeCode(codeDiff) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const cleanedCode = codeDiff
            .split("\n")
            .filter(line => !line.startsWith("diff") && !line.startsWith("@@")) // Remove metadata lines
            .join("\n");

        const prompt = `
        Review this GitHub PR code and return issues **strictly in valid JSON format**.
        Do not include \`\`\`json or any markdown formatting.  
        The JSON should be an array of objects, each having:
        - **path** (string)
        - **line** (number)
        - **issue** (string)
        - **suggestion** (string) (If no fix is available, return "No suggestion provided.")
        If no issues are found, return \`[]\`.

        Code: ${cleanedCode}
        `;

        const response = await model.generateContent(prompt);
        let aiResponse = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!aiResponse) {
            console.warn("⚠️ Gemini returned an empty response.");
            return []; // Return empty array instead of crashing
        }

        try {
            // 1️⃣ Remove ```json and similar markdown before parsing
            const cleanedResponse = aiResponse.replace(/```json|```|json/gi, '').trim();

            // 2️⃣ Extract valid JSON portion
            const jsonStartIndex = cleanedResponse.indexOf("[");
            const jsonEndIndex = cleanedResponse.lastIndexOf("]");

            if (jsonStartIndex >= 0 && jsonEndIndex >= 0) {
                aiResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
            }

            let parsedData = JSON.parse(aiResponse);

            // 3️⃣ Ensure suggestions are always present
            parsedData = parsedData.map(comment => ({
                ...comment,
                suggestion: comment.suggestion || "No suggestion provided."
            }));

            return parsedData;
        } catch (jsonError) {
            console.warn("⚠️ JSON parsing failed:", jsonError.message);
        }

        console.warn("⚠️ Gemini response is not valid JSON. Returning an empty array.");
        return []; // Return empty array as a fallback

    } catch (error) {
        console.error("❌ Gemini API Error:", error.message || error);
        return [];
    }
}

export { analyzeCode, formatAIComment };
