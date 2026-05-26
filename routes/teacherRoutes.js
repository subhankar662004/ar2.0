import express from "express";
import jwt from "jsonwebtoken";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import Result from "../models/Result.js";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "academic-hub-secret-key";

/* ── Auth: teacher or admin ── */
const verifyTeacher = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || (user.role !== "teacher" && user.role !== "admin"))
      return res.status(403).json({ message: "Teacher access required" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* ══ GET /api/teacher/tests — my tests ══ */
router.get("/tests", verifyTeacher, async (req, res) => {
  try {
    const tests = await Test.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ══ POST /api/teacher/tests — create test ══ */
router.post("/tests", verifyTeacher, async (req, res) => {
  try {
    const { title, description, category, subject, duration, startTime, endTime } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!duration)      return res.status(400).json({ message: "Duration is required" });

    const test = new Test({
      title: title.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "General",
      subject:  subject?.trim()   || "",
      duration: Number(duration),
      startTime: startTime || null,
      endTime:   endTime   || null,
      teacherId:   req.user._id,
      teacherName: req.user.name,
      createdBy:   req.user._id.toString(),
    });
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(500).json({ message: "Failed to create test", error: err.message });
  }
});

/* ══ PUT /api/teacher/tests/:id — update ══ */
router.put("/tests/:id", verifyTeacher, async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacherId: req.user._id });
    if (!test) return res.status(404).json({ message: "Test not found" });

    const { title, description, category, subject, duration, startTime, endTime } = req.body;
    Object.assign(test, {
      title:       title?.trim() || test.title,
      description: description?.trim() ?? test.description,
      category:    category?.trim() || test.category,
      subject:     subject?.trim()  || test.subject,
      duration:    duration ? Number(duration) : test.duration,
      startTime:   startTime || null,
      endTime:     endTime   || null,
    });
    await test.save();
    res.json(test);
  } catch (err) {
    res.status(500).json({ message: "Failed to update test", error: err.message });
  }
});

/* ══ DELETE /api/teacher/tests/:id ══ */
router.delete("/tests/:id", verifyTeacher, async (req, res) => {
  try {
    const test = await Test.findOneAndDelete({ _id: req.params.id, teacherId: req.user._id });
    if (!test) return res.status(404).json({ message: "Test not found" });
    await Question.deleteMany({ testId: req.params.id });
    await Result.deleteMany({ testId: req.params.id });
    res.json({ message: "Test deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete test", error: err.message });
  }
});

/* ══ POST /api/teacher/tests/:id/questions — add question ══ */
router.post("/tests/:id/questions", verifyTeacher, async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacherId: req.user._id });
    if (!test) return res.status(404).json({ message: "Test not found" });

    const { question, options, answer, explanation } = req.body;
    if (!question || !options || !answer)
      return res.status(400).json({ message: "Question, options and answer are required" });

    const q = new Question({
      testId: req.params.id,
      question: question.trim(),
      options,
      answer: answer.trim(),
      explanation: explanation?.trim() || "",
    });
    await q.save();
    res.status(201).json(q);
  } catch (err) {
    res.status(500).json({ message: "Failed to add question", error: err.message });
  }
});

/* ══ GET /api/teacher/tests/:id/questions ══ */
router.get("/tests/:id/questions", verifyTeacher, async (req, res) => {
  try {
    const qs = await Question.find({ testId: req.params.id });
    res.json(qs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch questions", error: err.message });
  }
});

/* ══ POST /api/teacher/tests/:id/questions/bulk — bulk upload from text ══ */
router.post("/tests/:id/questions/bulk", verifyTeacher, async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, teacherId: req.user._id });
    if (!test) return res.status(404).json({ message: "Test not found" });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "No text provided" });

    /* ── parse MCQ blocks ──
       Supported formats:
       1. Question text?        or   Q1. ...   or   1) ...
       A) option               or   A. option  or   a) option
       B) option
       C) option
       D) option
       Answer: A               or   Ans: A     or   Correct: A  or   Correct Answer: A
    */
    const blocks = text.trim().split(/\n{2,}/); // split by blank lines
    const parsed = [];
    const errors = [];

    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 3) continue;

      // First line is the question (strip leading numbering)
      const qLine = lines[0].replace(/^(Q\d+[\.\)]\s*|\d+[\.\)]\s*)/, '').trim();

      // Collect option lines: A) B) C) D) or A. B. C. D.
      const optLines = lines.slice(1).filter(l => /^[A-Da-d][\.\)]\s+/.test(l));
      const ansLine  = lines.find(l => /^(ans(wer)?|correct(\s+answer)?)\s*[:=]/i.test(l));

      if (!qLine || optLines.length < 2 || !ansLine) {
        errors.push(`Block ${i + 1}: skipped (incomplete — need question, ≥2 options, answer line)`);
        continue;
      }

      const options = optLines.map(l => l.replace(/^[A-Da-d][\.\)]\s+/, '').trim());
      // Extract answer letter/text
      const rawAns = ansLine.replace(/^(ans(wer)?|correct(\s+answer)?)\s*[:=]\s*/i, '').trim();
      // rawAns could be "A", "a", "Option text", etc.
      let answer = rawAns;
      if (/^[A-Da-d]$/.test(rawAns)) {
        // It's a letter — map to option text
        const idx = rawAns.toUpperCase().charCodeAt(0) - 65;
        if (options[idx]) answer = options[idx];
      }

      if (!options.includes(answer)) {
        errors.push(`Block ${i + 1}: answer "${answer}" not found in options — skipped`);
        continue;
      }

      parsed.push({ testId: req.params.id, question: qLine, options, answer });
    }

    if (parsed.length === 0) {
      return res.status(400).json({ message: "No valid questions found", errors });
    }

    const inserted = await Question.insertMany(parsed);
    res.status(201).json({ inserted: inserted.length, skipped: errors.length, errors, questions: inserted });
  } catch (err) {
    res.status(500).json({ message: "Bulk upload failed", error: err.message });
  }
});

/* ══ DELETE /api/teacher/questions/:qid ══ */
router.delete("/questions/:qid", verifyTeacher, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.qid);
    res.json({ message: "Question deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete question", error: err.message });
  }
});

/* ══ GET /api/teacher/tests/:id/results — student results ══ */
router.get("/tests/:id/results", verifyTeacher, async (req, res) => {
  try {
    const results = await Result.find({ testId: req.params.id })
      .populate("userId", "name email avatar role")
      .sort({ submittedAt: -1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch results", error: err.message });
  }
});

/* ══ GET /api/teacher/share/:shareCode — public, no auth ══ */
router.get("/share/:shareCode", async (req, res) => {
  try {
    const test = await Test.findOne({ shareCode: req.params.shareCode, isPublic: true });
    if (!test) return res.status(404).json({ message: "Test not found or not public" });
    const questions = await Question.find({ testId: test._id }).select("-answer -explanation");
    res.json({ test, questions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ══ GET /api/teacher/take/:testId — student take by ID, no auth ══ */
router.get("/take/:testId", async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found" });
    const questions = await Question.find({ testId: test._id }).select("-answer -explanation");
    res.json({ test, questions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ══ POST /api/teacher/take/:testId/submit ══ */
router.post("/take/:testId/submit", async (req, res) => {
  try {
    const { answers, userId, userName } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found" });

    /* Time window check */
    const now = new Date();
    if (test.startTime && now < new Date(test.startTime))
      return res.status(403).json({ message: "This test has not started yet" });
    if (test.endTime && now > new Date(test.endTime))
      return res.status(403).json({ message: "This test has ended" });

    /* Duplicate check */
    const existing = await Result.findOne({ userId, testId: test._id });
    if (existing) return res.status(409).json({ message: "You have already submitted this test" });

    const questions = await Question.find({ testId: test._id });
    let score = 0;
    const detailedAnswers = {};

    questions.forEach(q => {
      const given = answers[q._id.toString()];
      const correct = given === q.answer;
      if (correct) score++;
      detailedAnswers[q._id.toString()] = { given, correct, correctAnswer: q.answer };
    });

    const result = new Result({
      userId,
      testId: test._id,
      score,
      total: questions.length,
      answers,
    });
    await result.save();

    res.json({
      score,
      total: questions.length,
      pct: questions.length ? Math.round((score / questions.length) * 100) : 0,
      detailedAnswers,
      resultId: result._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit", error: err.message });
  }
});

export default router;
