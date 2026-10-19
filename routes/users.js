const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// GET: Fetch all users for the Team page
router.get('/', async (req, res) => {
  try {
    // We don't want to send passwords back to the frontend!
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching team members' });
  }
});

// POST: Invite/Create a new user
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    // 1. Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    // 2. Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Insert into database
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'employee']
    );

    res.status(201).json({
      message: 'User created successfully',
      user: { id: result.insertId, name, email, role: role || 'employee' }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while adding user' });
  }
});

module.exports = router;