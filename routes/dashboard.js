const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    // 1. Total Documents
    const [docsCount] = await db.query('SELECT COUNT(*) as total FROM documents');
    
    // 2. Total AI Questions Asked (counting user messages in chat)
    const [aiCount] = await db.query('SELECT COUNT(*) as total FROM chat_history WHERE role = "user"');
    
    // 3. Active Team Members (Total users)
    const [teamCount] = await db.query('SELECT COUNT(*) as total FROM users');
    
    // 4. Recently Updated Documents (Limit 4)
    const [recentDocs] = await db.query(
      `SELECT id, title, filename, category, file_size, status, created_at 
       FROM documents 
       ORDER BY created_at DESC LIMIT 4`
    );

    // 5. Categories with counts (Limit 4)
    const [categories] = await db.query(
      `SELECT category as name, COUNT(*) as count 
       FROM documents 
       WHERE category IS NOT NULL AND category != '' 
       GROUP BY category 
       ORDER BY count DESC LIMIT 4`
    );

    // Format categories to match frontend styling needs
    const tones = ['purple', 'blue', 'green', 'orange'];
    const formattedCategories = categories.map((c, i) => ({
      ...c,
      tone: tones[i % tones.length]
    }));

    res.json({
      stats: {
        totalDocuments: docsCount[0].total,
        aiQuestions: aiCount[0].total,
        activeTeam: teamCount[0].total,
        helpfulAnswers: "94.8%" // Hardcoded for now (requires thumbs up/down tracking in DB later)
      },
      recentDocuments: recentDocs,
      categories: formattedCategories
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

module.exports = router;