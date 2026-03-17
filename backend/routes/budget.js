const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/set", (req, res) => {
    const { user_id, budget_type, amount } = req.body;

    const checkSql = "SELECT * FROM budgets WHERE user_id = ? AND budget_type = ?";
    db.query(checkSql, [user_id, budget_type], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const updateSql = "UPDATE budgets SET amount = ? WHERE user_id = ? AND budget_type = ?";
            db.query(updateSql, [amount, user_id, budget_type], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: "Budget updated successfully" });
            });
        } else {
            const insertSql = "INSERT INTO budgets (user_id, budget_type, amount) VALUES (?, ?, ?)";
            db.query(insertSql, [user_id, budget_type, amount], (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: "Budget set successfully" });
            });
        }
    });
});

router.get("/all/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = "SELECT * FROM budgets WHERE user_id = ?";
    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/status/:user_id", (req, res) => {
    const { user_id } = req.params;

    const budgetSql = "SELECT * FROM budgets WHERE user_id = ?";
    const expenseSql = `
        SELECT 
            IFNULL(SUM(amount), 0) AS monthlySpent
        FROM expenses
        WHERE user_id = ?
        AND MONTH(expense_date) = MONTH(CURDATE())
        AND YEAR(expense_date) = YEAR(CURDATE())
    `;

    db.query(budgetSql, [user_id], (err, budgets) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query(expenseSql, [user_id], (err2, expenses) => {
            if (err2) return res.status(500).json({ error: err2.message });

            const monthlyBudget = budgets.find(b => b.budget_type === "monthly");
            const monthlySpent = Number(expenses[0].monthlySpent || 0);
            const budgetAmount = monthlyBudget ? Number(monthlyBudget.amount) : 0;
            const remaining = budgetAmount - monthlySpent;

            res.json({
                monthlyBudget: budgetAmount,
                monthlySpent: monthlySpent,
                remaining: remaining,
                exceeded: remaining < 0
            });
        });
    });
});

module.exports = router;