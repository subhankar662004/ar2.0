import express from 'express';
import Resource from '../models/Resource.js';

const router = express.Router();

// Search resources by filename or fileUrl (debug only)
// Example: GET /api/debug/resources/search?q=1772559181240-47604_Module%201
router.get('/resources/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.status(400).json({ message: 'Query parameter q is required' });
    }

    // decode in case caller sent an encoded filename
    const decoded = decodeURIComponent(q.trim());

    // Build search patterns
    const exactFileUrl = `/api/uploads/${decoded}`;
    const regex = new RegExp(decoded.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');

    const results = await Resource.find({
      $or: [
        { fileUrl: exactFileUrl },
        { fileUrl: { $regex: regex } },
        { fileName: { $regex: regex } }
      ]
    })
      .select('fileUrl fileName _id status contentType fileSize downloads createdAt')
      .limit(100)
      .lean();

    const mapped = results; // no fileData stored when using cloudinary

    res.json({ count: mapped.length, results: mapped });
  } catch (error) {
    console.error('Debug search error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;