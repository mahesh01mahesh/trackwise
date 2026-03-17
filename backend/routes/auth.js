const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const checkSql = "SELECT * FROM users WHERE email = ?";
        db.query(checkSql, [email], (checkErr, checkResults) => {
            if (checkErr) {
                return res.status(500).json({ error: checkErr.message });
            }

            if (checkResults.length > 0) {
                return res.status(400).json({ message: "Email already registered" });
            }

            const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
            db.query(sql, [name, email, hashedPassword], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                const userId = result.insertId;

                db.query(
                    "INSERT INTO settings (user_id, theme, language, email_notifications) VALUES (?, 'dark', 'english', true)",
                    [userId],
                    (sErr) => {
                        if (sErr) console.log("Settings insert error:", sErr.message);
                    }
                );

                db.query(
                    "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
                    [userId, "Welcome", "Your TrackWise account was created successfully"],
                    (nErr) => {
                        if (nErr) console.log("Notification insert error:", nErr.message);
                    }
                );

                res.json({ message: "User registered successfully" });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.json({
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                is_admin: !!user.is_admin
            }
        });
    });
});

router.post("/forgot-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length === 0) {
                return res.status(404).json({ message: "Email not found" });
            }

            const user = results[0];

            db.query(
                "UPDATE users SET password = ? WHERE email = ?",
                [hashedPassword, email],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    db.query(
                        "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
                        [user.id, "Password Changed", "Your password was reset successfully"],
                        () => {}
                    );

                    res.json({ message: "Password updated successfully" });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;