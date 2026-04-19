import express from 'express';
import { getRecentMessages, saveMessage, saveUserData, getUserData } from '../services/memory.js';

const router = express.Router();

router.get('/history', (req, res) => {
  const history = getRecentMessages();
  res.json({ history });
});

router.post('/save', (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: 'Role and content are required' });
  }
  saveMessage(role, content);
  res.json({ status: 'saved' });
});

router.get('/user-data', (req, res) => {
  const { key } = req.query;
  if (typeof key !== 'string') return res.status(400).json({ error: 'Key is required' });
  const value = getUserData(key);
  res.json({ value });
});

router.post('/user-data', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });
  saveUserData(key, value);
  res.json({ status: 'saved' });
});

export default router;
