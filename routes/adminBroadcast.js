import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import transporter from '../config/mailer.js';
import webpush from 'web-push';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'academic-hub-secret-key';

const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/* POST /api/admin/broadcast */
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { targetType, userIds, subject, message, channels } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });
    if (!channels?.length) return res.status(400).json({ message: 'Select at least one channel' });

    let recipients = [];
    if (targetType === 'all') {
      recipients = await User.find({}).select('_id name email');
    } else if (targetType === 'role' && req.body.role) {
      recipients = await User.find({ role: req.body.role }).select('_id name email');
    } else if (targetType === 'specific' && Array.isArray(userIds) && userIds.length > 0) {
      recipients = await User.find({ _id: { $in: userIds } }).select('_id name email');
    } else {
      return res.status(400).json({ message: 'Invalid target configuration' });
    }

    if (recipients.length === 0) return res.status(400).json({ message: 'No recipients found' });

    const results = { email: { sent: 0, failed: 0 }, push: { sent: 0, failed: 0 } };

    const emailSubject = subject?.trim() || 'Message from Academic Resources Hub';
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#2563eb;margin-bottom:4px;">Academic Resources Hub</h2>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <div style="font-size:15px;line-height:1.7;color:#374151;white-space:pre-wrap;">${message.trim()}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <p style="font-size:12px;color:#9ca3af;">This message was sent by the site admin. Do not reply to this email.</p>
      </div>`;

    /* ── Email ── */
    if (channels.includes('email')) {
      const emailPromises = recipients.map(async (u) => {
        try {
          await transporter.sendMail({
            from: `"Academic Resources Hub" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
            to: u.email,
            subject: emailSubject,
            html: htmlBody,
          });
          results.email.sent++;
        } catch {
          results.email.failed++;
        }
      });
      await Promise.allSettled(emailPromises);
    }

    /* ── Web Push ── */
    if (channels.includes('push')) {
      const payload = JSON.stringify({
        title: 'Academic Resources Hub',
        body: message.trim().slice(0, 200),
        url: '/',
        timestamp: Date.now(),
      });

      for (const u of recipients) {
        const subs = await PushSubscription.find({ userId: u._id.toString() });
        for (const s of subs) {
          try {
            await webpush.sendNotification(s.subscription, payload);
            results.push.sent++;
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await PushSubscription.findByIdAndDelete(s._id);
            }
            results.push.failed++;
          }
        }
      }
    }

    res.json({
      message: 'Broadcast complete',
      recipients: recipients.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ message: 'Broadcast failed', error: err.message });
  }
});

export default router;
