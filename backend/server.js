const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");
const reportRoutes = require("./routes/reports");
const categoryRoutes = require("./routes/categories");
const budgetRoutes = require("./routes/budget");
const profileRoutes = require("./routes/profile");
const notificationRoutes = require("./routes/notifications");
const settingsRoutes = require("./routes/settings");
const adminRoutes = require("./routes/admin");
const startMonthlyReportScheduler = require("./scheduler");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root route for Railway/browser test
app.get("/", (req, res) => {
  res.json({
    message: "TrackWise backend is live"
  });
});

app.use("/auth", authRoutes);
app.use("/expenses", expenseRoutes);
app.use("/reports", reportRoutes);
app.use("/categories", categoryRoutes);
app.use("/budget", budgetRoutes);
app.use("/profile", profileRoutes);
app.use("/notifications", notificationRoutes);
app.use("/settings", settingsRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

startMonthlyReportScheduler();