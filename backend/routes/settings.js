const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:user_id", (req, res) => {
    const { user_id } = req.params;

    db.query("SELECT * FROM settings WHERE user_id = ?", [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.json({
                theme: "dark",
                language: "english",
                email_notifications: 1
            });
        }

        res.json(results[0]);
    });
});

router.put("/update/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { theme, language, email_notifications } = req.body;

    db.query("SELECT * FROM settings WHERE user_id = ?", [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            db.query(
                "INSERT INTO settings (user_id, theme, language, email_notifications) VALUES (?, ?, ?, ?)",
                [user_id, theme, language, email_notifications],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: "Settings saved successfully" });
                }
            );
        } else {
            db.query(
                "UPDATE settings SET theme = ?, language = ?, email_notifications = ? WHERE user_id = ?",
                [theme, language, email_notifications, user_id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: "Settings updated successfully" });
                }
            );
        }
    });
});

module.exports = router;