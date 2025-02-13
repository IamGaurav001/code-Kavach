import mongoose from "mongoose";

const PRSchema = new mongoose.Schema({
  repo: String,
  prNumber: Number,
  reviewComments: [
    {
      line: Number,
      issue: String,
      suggestion: String,
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("PullRequestReview", PRSchema);
