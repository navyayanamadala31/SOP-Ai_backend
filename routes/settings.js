const express = require('express');
const router = express.Router();
const db = require('../db');

// GET: Fetch user settings
router.get('/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, email_notifications, compact_lists FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert 1/0 from MySQL to true/false for React
    const user = rows[0];
    user.email_notifications = Boolean(user.email_notifications);
    user.compact_lists = Boolean(user.compact_lists);

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// PUT: Update user settings
router.put('/:userId', async (req, res) => {
  const { name, email_notifications, compact_lists } = req.body;

  try {
    await db.query(
      'UPDATE users SET name = ?, email_notifications = ?, compact_lists = ? WHERE id = ?',
      [name, email_notifications, compact_lists, req.params.userId]
    );

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

module.exports = router;