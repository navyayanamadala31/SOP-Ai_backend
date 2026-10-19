const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../db");

const router = express.Router();

// ─────────────────────────────────────────────
// Upload setup
// ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ok = [".pdf", ".docx"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(ok ? null : new Error("Only PDF and DOCX allowed"), ok);
  },
});

// ─────────────────────────────────────────────
// Helper: extract text based on file type
// ─────────────────────────────────────────────
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  }
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  throw new Error("Unsupported file type");
}

// Helper: format bytes to "x.y MB"
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// Helper: readable snippet around first query match
function buildSnippet(text, query, maxLen) {
  const q = query.toLowerCase().split(/\s+/)[0];
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 200);
  return text.slice(start, start + maxLen);
}

// ─────────────────────────────────────────────
// STEP 1 + 2 + 3: POST /api/documents  (Add Document)
// ─────────────────────────────────────────────
router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { originalname, path: filePath, mimetype, size } = req.file;

    // Step 3: extract text
    let extractedText = "";
    try {
      extractedText = await extractText(filePath, mimetype);
    } catch (parseErr) {
      console.error("Parse error:", parseErr.message);
      fs.unlinkSync(filePath); // cleanup
      return res.status(422).json({
        success: false,
        message: "Could not extract text from file",
        error: parseErr.message,
      });
    }

    // Step 2: store metadata + extracted text in DB
    const uploadedBy = req.body.uploaded_by || "admin";
    const category = req.body.category || "Uncategorized";
    const title = (req.body.title && req.body.title.trim()) || originalname;

    const [result] = await db.execute(
      `INSERT INTO documents
         (filename, title, category, filepath, mime_type, file_size,
          extracted_text, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Processing')`,
      [
        originalname,
        title,
        category,
        filePath,
        mimetype,
        size,
        extractedText,
        uploadedBy,
      ]
    );

    // Naive "publish" flip — replace with a real background job if needed
    setTimeout(async () => {
      try {
        await db.execute(
          `UPDATE documents SET status = 'Published' WHERE id = ?`,
          [result.insertId]
        );
      } catch (e) {
        console.error("Status flip failed:", e.message);
      }
    }, 4000);

    return res.status(201).json({
      success: true,
      message: "Document uploaded and processed",
      document: {
        id: result.insertId,
        filename: originalname,
        title,
        category,
        filepath: filePath,
        size: formatSize(size),
        mime_type: mimetype,
        uploaded_by: uploadedBy,
        status: "Processing",
        textLength: extractedText.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/documents  — list all
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, filename, title, category, filepath, mime_type, file_size,
              uploaded_by, status, created_at,
              CHAR_LENGTH(extracted_text) AS text_length
       FROM documents
       ORDER BY created_at DESC`
    );

    const documents = rows.map((r) => ({
      ...r,
      size: formatSize(r.file_size),
    }));

    res.json({ success: true, documents });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/documents/:id — fetch single (used for polling)
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, filename, title, category, file_size, uploaded_by,
              status, created_at
       FROM documents WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({
      success: true,
      document: {
        ...rows[0],
        size: formatSize(rows[0].file_size),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// STEP 4 + 5: POST /api/documents/search  (Search + Answer)
// ─────────────────────────────────────────────
router.post("/search", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: "Query required" });
    }

    // Step 4: search extracted text using MySQL FULLTEXT
    const [rows] = await db.execute(
      `SELECT id, filename, title, extracted_text,
              MATCH(extracted_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
       FROM documents
       WHERE MATCH(extracted_text) AGAINST (? IN NATURAL LANGUAGE MODE)
       ORDER BY score DESC
       LIMIT 5`,
      [query, query]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        answer: "No relevant information found in documents.",
        sources: [],
      });
    }

    // Step 5: build answer from top chunks (naive RAG)
    const top = rows[0];
    const snippet = buildSnippet(top.extracted_text, query, 800);

    // To use a real LLM, replace the next line with an OpenAI/Claude call:
    //   const answer = await askLLM(query, snippet);
    const answer = `Based on "${top.title || top.filename}":\n\n${snippet}`;

    res.json({
      success: true,
      answer,
      sources: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        title: r.title,
        score: r.score,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;