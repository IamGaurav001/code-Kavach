import PRModel from "./model/PRModel.js";

export async function savePRReview(prNumber, repo, reviewComments) {
    try {
      console.log(`🔹 Saving PR #${prNumber} to Database...`);
      
      const newPR = new PRModel({ prNumber, repo, reviewComments });
      await newPR.save();
  
      console.log("✅ PR Review Saved Successfully!");
    } catch (error) {
      console.error("❌ Error Saving PR Review:", error);
    }
  }