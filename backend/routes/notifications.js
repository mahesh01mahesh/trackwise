const express = require("express");
const router = express.Router();
const db = require("../db");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "YOUR_GMAIL@gmail.com",
        pass: "YOUR_APP_PASSWORD"
    }
});

function buildExpenseQuery(user_id, from_date, to_date) {
    let sql = "SELECT * FROM expenses WHERE user_id = ?";
    let params = [user_id];

    if (from_date) {
        sql += " AND expense_date >= ?";
        params.push(from_date);
    }

    if (to_date) {
        sql += " AND expense_date <= ?";
        params.push(to_date);
    }

    sql += " ORDER BY expense_date DESC, id DESC";

    return { sql, params };
}

router.post("/send-email", (req, res) => {
    const { user_id, email } = req.body;

    const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC";

    db.query(sql, [user_id], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let reportText = "TrackWise Expense Report\n\n";

        if (results.length === 0) {
            reportText += "No expenses found.";
        } else {
            results.forEach((exp) => {
                reportText += `Date: ${new Date(exp.expense_date).toISOString().split("T")[0]} | Amount: ₹${exp.amount} | Category: ${exp.category} | Payment: ${exp.payment_method} | Description: ${exp.description || ""}\n`;
            });
        }

        try {
            await transporter.sendMail({
                from: "YOUR_GMAIL@gmail.com",
                to: email,
                subject: "TrackWise Expense Report",
                text: reportText
            });

            db.query(
                "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
                [user_id, "Report Sent", "Your expense report was sent by email"],
                () => {}
            );

            res.json({ message: "Report sent successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

router.post("/send-monthly-now", (req, res) => {
    const { user_id } = req.body;

    const userSql = "SELECT id, name, email FROM users WHERE id = ?";

    db.query(userSql, [user_id], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        if (users.length === 0) return res.status(404).json({ message: "User not found" });

        const user = users[0];

        const expenseSql = `
            SELECT * FROM expenses
            WHERE user_id = ?
            AND MONTH(expense_date) = MONTH(CURRENT_DATE)
            AND YEAR(expense_date) = YEAR(CURRENT_DATE)
            ORDER BY expense_date DESC
        `;

        db.query(expenseSql, [user_id], async (err2, expenses) => {
            if (err2) return res.status(500).json({ error: err2.message });

            let reportText = `Hello ${user.name},\n\nYour current month expense report:\n\n`;

            if (expenses.length === 0) {
                reportText += "No expenses found for this month.";
            } else {
                expenses.forEach((exp) => {
                    reportText += `Date: ${new Date(exp.expense_date).toISOString().split("T")[0]} | Amount: ₹${exp.amount} | Category: ${exp.category} | Payment: ${exp.payment_method} | Description: ${exp.description || ""}\n`;
                });
            }

            try {
                await transporter.sendMail({
                    from: "YOUR_GMAIL@gmail.com",
                    to: user.email,
                    subject: "TrackWise Monthly Expense Report",
                    text: reportText
                });

                db.query(
                    "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
                    [user_id, "Monthly Report Sent", "Your monthly report was sent to your registered email"],
                    () => {}
                );

                res.json({ message: "Monthly report sent successfully" });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    });
});

router.get("/pdf/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { from_date, to_date } = req.query;

    const { sql, params } = buildExpenseQuery(user_id, from_date, to_date);

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=trackwise-report.pdf");

        doc.pipe(res);
        doc.fontSize(18).text("TrackWise Expense Report", { align: "center" });
        doc.moveDown();

        if (results.length === 0) {
            doc.fontSize(12).text("No expenses found.");
        } else {
            results.forEach((exp, index) => {
                doc.fontSize(12).text(
                    `${index + 1}. Date: ${new Date(exp.expense_date).toISOString().split("T")[0]} | Amount: ₹${exp.amount} | Category: ${exp.category} | Payment: ${exp.payment_method} | Description: ${exp.description || ""}`
                );
                doc.moveDown(0.5);
            });
        }

        doc.end();
    });
});

router.get("/excel/:user_id", async (req, res) => {
    const { user_id } = req.params;
    const { from_date, to_date } = req.query;

    const { sql, params } = buildExpenseQuery(user_id, from_date, to_date);

    db.query(sql, params, async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Expenses");

        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Date", key: "expense_date", width: 15 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Category", key: "category", width: 20 },
            { header: "Payment Method", key: "payment_method", width: 20 },
            { header: "Description", key: "description", width: 30 },
            { header: "Receipt", key: "receipt", width: 25 }
        ];

        results.forEach(exp => {
            worksheet.addRow({
                id: exp.id,
                expense_date: new Date(exp.expense_date).toISOString().split("T")[0],
                amount: exp.amount,
                category: exp.category,
                payment_method: exp.payment_method,
                description: exp.description || "",
                receipt: exp.receipt || ""
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", "attachment; filename=trackwise-report.xlsx");

        await workbook.xlsx.write(res);
        res.end();
    });
});

router.get("/csv/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { from_date, to_date } = req.query;

    const { sql, params } = buildExpenseQuery(user_id, from_date, to_date);

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let csv = "ID,Date,Amount,Category,Payment Method,Description,Receipt\n";

        results.forEach(exp => {
            const row = [
                exp.id,
                new Date(exp.expense_date).toISOString().split("T")[0],
                exp.amount,
                `"${exp.category || ""}"`,
                `"${exp.payment_method || ""}"`,
                `"${(exp.description || "").replace(/"/g, '""')}"`,
                `"${exp.receipt || ""}"`
            ].join(",");

            csv += row + "\n";
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=trackwise-report.csv");
        res.send(csv);
    });
});

module.exports = router;