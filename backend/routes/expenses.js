const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

function checkBudgetAndNotify(user_id) {
    const budgetSql = `
        SELECT amount FROM budgets
        WHERE user_id = ? AND budget_type = 'monthly'
        LIMIT 1
    `;

    const expenseSql = `
        SELECT IFNULL(SUM(amount), 0) AS totalSpent
        FROM expenses
        WHERE user_id = ?
        AND MONTH(expense_date) = MONTH(CURDATE())
        AND YEAR(expense_date) = YEAR(CURDATE())
    `;

    db.query(budgetSql, [user_id], (err, budgetRows) => {
        if (err || budgetRows.length === 0) return;

        const budgetAmount = Number(budgetRows[0].amount);

        db.query(expenseSql, [user_id], (err2, expenseRows) => {
            if (err2) return;

            const totalSpent = Number(expenseRows[0].totalSpent);

            if (totalSpent > budgetAmount) {
                db.query(
                    "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
                    [
                        user_id,
                        "Budget Exceeded",
                        `You exceeded your monthly budget. Budget: ₹${budgetAmount}, Spent: ₹${totalSpent}`
                    ],
                    () => {}
                );
            }
        });
    });
}

function validateExpense(data) {
    const { user_id, expense_date, amount, category, payment_method } = data;

    if (!user_id) return "User is required";
    if (!expense_date) return "Expense date is required";
    if (!amount || Number(amount) <= 0) return "Amount must be greater than 0";
    if (!category || !category.trim()) return "Category is required";
    if (!payment_method || !payment_method.trim()) return "Payment method is required";

    return null;
}

router.post("/add", upload.single("receipt"), (req, res) => {
    const { user_id, expense_date, amount, category, payment_method, description } = req.body;
    const receipt = req.file ? req.file.filename : null;

    const errorMsg = validateExpense(req.body);
    if (errorMsg) {
        return res.status(400).json({ message: errorMsg });
    }

    const sql = `
        INSERT INTO expenses (user_id, expense_date, amount, category, payment_method, description, receipt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [user_id, expense_date, amount, category.trim(), payment_method.trim(), description || "", receipt],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });

            checkBudgetAndNotify(user_id);
            res.json({ message: "Expense added successfully" });
        }
    );
});

router.get("/all/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { sort_by, order } = req.query;

    let sql = "SELECT * FROM expenses WHERE user_id = ?";
    const params = [user_id];

    const allowedSort = ["expense_date", "amount"];
    const allowedOrder = ["ASC", "DESC"];

    if (allowedSort.includes(sort_by) && allowedOrder.includes((order || "").toUpperCase())) {
        sql += ` ORDER BY ${sort_by} ${order.toUpperCase()}, id DESC`;
    } else {
        sql += " ORDER BY expense_date DESC, id DESC";
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/recent/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT * FROM expenses
        WHERE user_id = ?
        ORDER BY expense_date DESC, id DESC
        LIMIT 5
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/search/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { category, payment_method, from_date, to_date, min_amount, max_amount, sort_by, order } = req.query;

    let sql = "SELECT * FROM expenses WHERE user_id = ?";
    let params = [user_id];

    if (category) {
        sql += " AND category = ?";
        params.push(category);
    }

    if (payment_method) {
        sql += " AND payment_method = ?";
        params.push(payment_method);
    }

    if (from_date) {
        sql += " AND expense_date >= ?";
        params.push(from_date);
    }

    if (to_date) {
        sql += " AND expense_date <= ?";
        params.push(to_date);
    }

    if (min_amount) {
        sql += " AND amount >= ?";
        params.push(min_amount);
    }

    if (max_amount) {
        sql += " AND amount <= ?";
        params.push(max_amount);
    }

    const allowedSort = ["expense_date", "amount"];
    const allowedOrder = ["ASC", "DESC"];

    if (allowedSort.includes(sort_by) && allowedOrder.includes((order || "").toUpperCase())) {
        sql += ` ORDER BY ${sort_by} ${order.toUpperCase()}, id DESC`;
    } else {
        sql += " ORDER BY expense_date DESC, id DESC";
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/one/:id", (req, res) => {
    const { id } = req.params;

    db.query("SELECT * FROM expenses WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Expense not found" });
        res.json(results[0]);
    });
});

router.put("/update/:id", upload.single("receipt"), (req, res) => {
    const { id } = req.params;
    const { expense_date, amount, category, payment_method, description } = req.body;
    const newReceipt = req.file ? req.file.filename : null;

    const errorMsg = validateExpense({ ...req.body, user_id: 1 });
    if (!expense_date || !amount || !category || !payment_method) {
        return res.status(400).json({ message: "All required fields must be filled" });
    }
    if (Number(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    db.query("SELECT receipt, user_id FROM expenses WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const oldReceipt = results.length ? results[0].receipt : null;
        const user_id = results.length ? results[0].user_id : null;
        const finalReceipt = newReceipt || oldReceipt;

        const sql = `
            UPDATE expenses
            SET expense_date = ?, amount = ?, category = ?, payment_method = ?, description = ?, receipt = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [expense_date, amount, category.trim(), payment_method.trim(), description || "", finalReceipt, id],
            (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });

                if (user_id) checkBudgetAndNotify(user_id);
                res.json({ message: "Expense updated successfully" });
            }
        );
    });
});

router.delete("/delete/:id", (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM expenses WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Expense deleted successfully" });
    });
});

router.get("/summary/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT
            IFNULL(SUM(amount), 0) AS totalExpense,
            IFNULL(MAX(amount), 0) AS highestExpense,
            IFNULL(MIN(amount), 0) AS lowestExpense
        FROM expenses
        WHERE user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

router.get("/advanced-summary/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT
            IFNULL(SUM(CASE WHEN expense_date = CURDATE() THEN amount ELSE 0 END), 0) AS todayTotal,
            IFNULL(SUM(CASE WHEN YEARWEEK(expense_date, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END), 0) AS weekTotal,
            IFNULL(SUM(CASE WHEN MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS monthTotal,
            IFNULL(SUM(CASE WHEN YEAR(expense_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS yearTotal
        FROM expenses
        WHERE user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

router.get("/category-extremes/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT category, SUM(amount) AS total
        FROM expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.json({
                topCategory: "None",
                topAmount: 0,
                lowCategory: "None",
                lowAmount: 0
            });
        }

        const top = results[0];
        const low = results[results.length - 1];

        res.json({
            topCategory: top.category,
            topAmount: top.total,
            lowCategory: low.category,
            lowAmount: low.total
        });
    });
});

router.get("/category-chart/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT category, SUM(amount) AS total
        FROM expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get("/monthly-chart/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS total
        FROM expenses
        WHERE user_id = ?
        GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
        ORDER BY month
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;