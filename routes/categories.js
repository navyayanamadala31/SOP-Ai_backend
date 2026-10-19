const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/categories
// Fetches unique categories and counts how many docs are in each
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT category as name, COUNT(*) as count 
       FROM documents 
       WHERE category IS NOT NULL AND category != '' 
       GROUP BY category 
       ORDER BY count DESC`
    );

    // Add some default descriptions/tone for the UI
    const categoryDetails = {
      'Development': { description: 'Technical documentation, API guides, and code standards.', tone: 'purple' },
      'HR & Policies': { description: 'Employee handbooks, leave policies, and onboarding guides.', tone: 'orange' },
      'Sales & Marketing': { description: 'Playbooks, brand guidelines, and campaign strategies.', tone: 'blue' },
      'Security': { description: 'Compliance, security protocols, and incident response.', tone: 'green' },
      'Operations': { description: 'Standard operating procedures and daily workflows.', tone: 'pink' }
    };

    const formattedCategories = rows.map(row => {
      const details = categoryDetails[row.name] || { 
        description: `Browse all documents related to ${row.name}.`, 
        tone: 'purple' 
      };
      
      return {
        name: row.name,
        count: row.count,
        description: details.description,
        tone: details.tone
      };
    });

    res.json(formattedCategories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

module.exports = router;