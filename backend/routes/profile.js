const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");

router.get("/:id", (req, res) => {
    const { id } = req.params;

    db.query("SELECT id, name, email FROM users WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(results[0]);
    });
});

router.put("/update/:id", (req, res) => {
    const { id } = req.params;
    const { name, email, password } = req.body;

    if (password && password.trim() !== "") {
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
            if (hashErr) return res.status(500).json({ error: hashErr.message });

            const sql = "UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?";
            db.query(sql, [name, email, hashedPassword, id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Profile updated successfully" });
            });
        });
    } else {
        const sql = "UPDATE users SET name = ?, email = ? WHERE id = ?";
        db.query(sql, [name, email, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Profile updated successfully" });
        });
    }
});

module.exports = router;