const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const documentsRouter = require("./routes/documents"); // Assuming you have this
const authRouter = require("./routes/auth"); // NEW AUTH ROUTE
const usersRouter = require("./routes/users");
const categoriesRouter = require("./routes/categories");
const chatRouter = require("./routes/chat");
const settingsRouter = require("./routes/settings");
const dashboardRouter = require("./routes/dashboard");

// Use routes
app.use("/api/documents", documentsRouter);
app.use("/api/auth", authRouter); // NEW AUTH ENDPOINT
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth/login`);
});