import express from "express";
import fetch from "node-fetch";
import GeneratedTest from "../models/GeneratedTest.js";

const router = express.Router();

// Save generated MCQ
router.post("/save", async (req, res) => {
  try {
    const { userId, moduleName, questions } = req.body;

    const test = new GeneratedTest({
      userId,
      moduleName,
      questions
    });

    await test.save();

    res.json(test);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Get single AI test
router.get("/test/:id", async (req,res)=>{

const test = await GeneratedTest.findById(req.params.id);

res.json(test);

});
// Get user tests
router.get("/:userId", async (req, res) => {

  const tests = await GeneratedTest.find({
    userId: req.params.userId
  });

  res.json(tests);
});

// Delete test
router.delete("/:id", async (req, res) => {

  await GeneratedTest.findByIdAndDelete(req.params.id);

  res.json({ message: "Deleted" });

});
router.post("/generate", async (req, res) => {

try{

const { moduleText, count } = req.body;

const prompt = `
Generate ${count} MCQ questions.

Return ONLY JSON array like this:

[
{
"question":"",
"options":["","","",""],
"answer":"",
"explanation":""
}
]

Text:
${moduleText}
`;

const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.GROQ_API_KEY}`
},
body:JSON.stringify({
model:"llama-3.1-8b-instant",
messages:[
{role:"user",content:prompt}
]
})
});

const data = await response.json();

console.log("AI response:", data);

if(!data.choices){
return res.json([]);
}

let content = data.choices[0].message.content;

content = content.replace(/```json/g,"").replace(/```/g,"");

let questions;

try{
questions = JSON.parse(content);
}catch(err){
console.log("JSON parse error:", content);
return res.json([]);
}

res.json(questions);

}catch(err){

console.log("AI ERROR:", err);

res.json([]);

}

});
export default router;