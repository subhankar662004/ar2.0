import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'academic-hub-secret-key';

/* ── Auth middlewares ── */
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/* ── Cloudinary storage for avatars ── */
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'academic-avatars',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  },
});

/* ══ ROUTES ══════════════════════════════════════════ */

/* Get all users (admin) */
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Get current user's profile */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Get user by ID */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Update profile (name, bio) */
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (bio  !== undefined) updates.bio  = String(bio).trim();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select('-password');

    /* Return same shape as login so the frontend auth context stays consistent */
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Upload / replace avatar */
router.post('/avatar', verifyToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const oldUser = await User.findById(req.user._id);

    /* Delete old avatar from Cloudinary if it exists */
    if (oldUser.avatar) {
      try {
        const parts = oldUser.avatar.split('/');
        const fileWithExt = parts[parts.length - 1];
        const publicId = `academic-avatars/${fileWithExt.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch { /* non-fatal */ }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path },
      { new: true }
    ).select('-password');

    const userObj = { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, bio: user.bio };
    res.json({ avatar: user.avatar, user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

/* Remove avatar */
router.delete('/avatar', verifyToken, async (req, res) => {
  try {
    const oldUser = await User.findById(req.user._id);

    /* Delete from Cloudinary */
    if (oldUser.avatar) {
      try {
        const parts = oldUser.avatar.split('/');
        const fileWithExt = parts[parts.length - 1];
        const publicId = `academic-avatars/${fileWithExt.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch { /* non-fatal */ }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: '' },
      { new: true }
    ).select('-password');

    const userObj = { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, bio: user.bio };
    res.json({ message: 'Avatar removed', user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Edit user profile (admin only — name, bio) */
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (bio  !== undefined) updates.bio  = String(bio).trim();

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Ban / unban user (admin only) */
router.put('/:id/ban', verifyAdmin, async (req, res) => {
  try {
    const { isBanned } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: !!isBanned },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: isBanned ? 'User banned' : 'User unbanned', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Change user role (admin only) */
router.put('/:id/role', verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['student', 'teacher', 'admin'];
    if (!allowed.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `Role updated to ${role}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* Delete user (admin) */
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
