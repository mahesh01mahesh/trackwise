const cron = require("node-cron");
const db = require("./db");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "bhavanashetty68@gmail.com",
        pass: "cyqx gpap zckv cppu"
    }
});

function startMonthlyReportScheduler() {
    cron.schedule("0 9 1 * *", () => {
        console.log("Running monthly email scheduler...");

        const userSql = `
            SELECT u.id, u.name, u.email, s.email_notifications
            FROM users u
            LEFT JOIN settings s ON u.id = s.user_id
        `;

        db.query(userSql, (err, users) => {
            if (err) {
                console.log("Scheduler user fetch error:", err.message);
                return;
            }

            users.forEach((user) => {
                if (!user.email_notifications) return;

                const expenseSql = `
                    SELECT * FROM expenses
                    WHERE user_id = ?
                    AND MONTH(expense_date) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)
                    AND YEAR(expense_date) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)
                    ORDER BY expense_date DESC
                `;

                db.query(expenseSql, [user.id], async (err2, expenses) => {
                    if (err2) {
                        console.log("Scheduler expense fetch error:", err2.message);
                        return;
                    }

                    let reportText = `Hello ${user.name},\n\nYour TrackWise monthly expense report:\n\n`;

                    if (expenses.length === 0) {
                        reportText += "No expenses found for last month.";
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
                            [user.id, "Monthly Report Sent", "Your monthly email report was sent successfully"],
                            () => {}
                        );
                    } catch (mailErr) {
                        console.log("Scheduler email error:", mailErr.message);
                    }
                });
            });
        });
    });
}

module.exports = startMonthlyReportScheduler;