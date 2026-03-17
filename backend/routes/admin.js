const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/users", (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.is_admin,
               COUNT(e.id) AS total_expenses,
               IFNULL(SUM(e.amount), 0) AS total_amount
        FROM users u
        LEFT JOIN expenses e ON u.id = e.user_id
        GROUP BY u.id, u.name, u.email, u.is_admin
        ORDER BY u.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/expenses/:user_id", (req, res) => {
    const { user_id } = req.params;

    db.query(
        "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC",
        [user_id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

router.delete("/user/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted successfully" });
    });
});

module.exports = router;