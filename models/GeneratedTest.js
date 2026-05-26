import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: String,
  explanation: String
});

const generatedTestSchema = new mongoose.Schema({
  userId: String,
  moduleName: String,
  questions: [questionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("GeneratedTest", generatedTestSchema);