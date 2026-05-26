import express from "express";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import Result from "../models/Result.js";

const router = express.Router();

// Create new test
router.post("/create", async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subject,
      duration,
      startTime,
      endTime,
      createdBy
    } = req.body;

    const test = new Test({
      title,
      description,
      category: category || "CSE",
      subject: subject || "",
      duration,
      startTime: startTime || null,
      endTime: endTime || null,
      createdBy
    });

    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({
      message: "Failed to create test",
      error: error.message
    });
  }
});

// Get all tests category-wise
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    const tests = await Test.find(query).sort({ createdAt: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch tests",
      error: error.message
    });
  }
});

// Update test, including optional start/end time
router.put("/:id", async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subject,
      duration,
      startTime,
      endTime
    } = req.body;

    const updateData = {
      title,
      description,
      category,
      subject,
      duration,
      startTime: startTime || null,
      endTime: endTime || null
    };

    const test = await Test.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    res.json(test);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update test",
      error: error.message
    });
  }
});

// Add question to a test
router.post("/:testId/question", async (req, res) => {
  try {
    const { testId } = req.params;
    const question = new Question({ ...req.body, testId });
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({
      message: "Failed to add question",
      error: error.message
    });
  }
});

// Get all questions of a test
router.get("/:testId/questions", async (req, res) => {
  try {
    const { testId } = req.params;
    const questions = await Question.find({ testId });
    res.json(questions);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch questions",
      error: error.message
    });
  }
});

// Delete a single question
router.delete("/:testId/questions/:questionId", async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.questionId);
    res.json({ message: "Question deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error: error.message });
  }
});

// Edit a single question
router.put("/:testId/questions/:questionId", async (req, res) => {
  try {
    const { title, options, answer } = req.body;
    const question = await Question.findByIdAndUpdate(
      req.params.questionId,
      { title, options, answer },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error: error.message });
  }
});

// Admin see results of a test
router.get("/:testId/results", async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.testId })
      .populate("userId", "name email")
      .populate("testId", "title category subject duration startTime endTime")
      .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch results",
      error: error.message
    });
  }
});

// Delete test
router.delete("/:id", async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);

    await Question.deleteMany({ testId: req.params.id });
    await Result.deleteMany({ testId: req.params.id });

    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete test",
      error: error.message
    });
  }
});

export default router;