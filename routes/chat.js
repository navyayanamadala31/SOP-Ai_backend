const express = require('express');
const router = express.Router();
const db = require('../db');

// GET: Fetch chat history for a specific user
router.get('/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM chat_history WHERE user_id = ? ORDER BY created_at ASC',
      [req.params.userId]
    );
    
    // Format to match frontend expectations
    const messages = rows.map(row => ({
      id: row.id,
      role: row.role,
      text: row.message,
      source: row.source
    }));

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
});

// POST: Save a new message (either user question or assistant answer)
router.post('/', async (req, res) => {
  const { userId, role, text, source } = req.body;

  if (!userId || !role || !text) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO chat_history (user_id, role, message, source) VALUES (?, ?, ?, ?)',
      [userId, role, text, source || null]
    );

    res.status(201).json({ 
      id: result.insertId, 
      role, 
      text, 
      source 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving message' });
  }
});

// DELETE: Clear chat history for a user
router.delete('/:userId', async (req, res) => {
  try {
    await db.query('DELETE FROM chat_history WHERE user_id = ?', [req.params.userId]);
    res.json({ message: 'Chat cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing chat' });
  }
});

module.exports = router;