const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/add", (req, res) => {
    const { user_id, category_name } = req.body;

    if (!user_id || !category_name || !category_name.trim()) {
        return res.status(400).json({ message: "Category name is required" });
    }

    const cleanName = category_name.trim();

    const checkSql = "SELECT * FROM categories WHERE user_id = ? AND LOWER(category_name) = LOWER(?)";
    db.query(checkSql, [user_id, cleanName], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            return res.status(400).json({ message: "Category already exists" });
        }

        const sql = "INSERT INTO categories (user_id, category_name) VALUES (?, ?)";
        db.query(sql, [user_id, cleanName], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: "Category added successfully" });
        });
    });
});

router.get("/all/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = "SELECT * FROM categories WHERE user_id = ? ORDER BY category_name ASC";
    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.put("/update/:id", (req, res) => {
    const { id } = req.params;
    const { category_name } = req.body;

    if (!category_name || !category_name.trim()) {
        return res.status(400).json({ message: "Category name is required" });
    }

    const sql = "UPDATE categories SET category_name = ? WHERE id = ?";
    db.query(sql, [category_name.trim(), id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Category updated successfully" });
    });
});

router.delete("/delete/:id", (req, res) => {
    const { id } = req.params;

    const sql = "DELETE FROM categories WHERE id = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Category deleted successfully" });
    });
});

module.exports = router;