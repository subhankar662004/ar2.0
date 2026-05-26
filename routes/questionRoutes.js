import express from "express";
import Question from "../models/Question.js"; 

const router = express.Router();

router.post("/add", async (req, res) => {
  const q = new Question(req.body);
  await q.save();
  res.json(q);
});

router.get("/", async (req, res) => {
  const data = await Question.find();
  res.json(data);
});

export default router;