// ---------------- LOAD ENV ----------------
require("dotenv").config();

// ---------------- IMPORTS ----------------
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

// ---------------- APP INIT ----------------
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MIDDLEWARE ----------------
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontendd")));

// ---------------- HELPERS ----------------

// Get IST Date Object
function getNowIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// Get IST Date String (YYYY-MM-DD)
function getISTDateString(date = new Date()) {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().split("T")[0];
}


// Format IST datetime for MySQL (avoids UTC shift)
function formatDateTimeForMySQL(date) {
  const pad = (n) => (n < 10 ? "0" + n : n);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


// ---------------- EMAIL TRANSPORT ----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ---------------- ROUTES ----------------

// Root → login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontendd/html/login.html"));
});

// ---------------- PAGE ROUTES ----------------

// Admin Dashboard Page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontendd/html/admin.html"));
});

// Leave Requests Page
app.get("/requests", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontendd/html/requests.html"));
});


// ---------------- LOGIN ----------------
app.post("/login", (req, res) => {
  const { worker_id, password } = req.body;
  const sql = "SELECT * FROM users WHERE worker_id = ? AND password = ?";
  db.query(sql, [worker_id, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message, success: false });
    if (results.length === 0)
      return res.status(401).json({ error: "Invalid credentials", success: false });

    const user = results[0];
    res.json({
      worker_id: user.worker_id,
      role: user.role,
      job: user.job,
      email: user.email,
      success: true,
    });
  });
});


app.post("/checkin", (req, res) => {
  const { worker_id, role } = req.body;

  if (role !== "worker")
    return res.status(403).json({ error: "Only workers can check in", success: false });

  const nowIST = getNowIST(); // Current IST time

  // 1️⃣ Get worker’s assigned shift
  const shiftQuery = `
    SELECT s.id AS shift_id, s.shift_name, s.start_time, s.end_time
    FROM users u
    JOIN shifts s ON u.shift_id = s.id
    WHERE u.worker_id = ?
  `;

  db.query(shiftQuery, [worker_id], (err, shiftResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (shiftResults.length === 0)
      return res.status(404).json({ error: "Shift not found for this worker" });

    const shift = shiftResults[0];
    const [shStartH, shStartM, shStartS] = shift.start_time.split(":").map(Number);
    const [shEndH, shEndM, shEndS] = shift.end_time.split(":").map(Number);

    // 2️⃣ Build shift start & end times
    let shiftStart = new Date();
    shiftStart.setHours(shStartH, shStartM, shStartS, 0);

    let shiftEnd = new Date(shiftStart);
    shiftEnd.setHours(shEndH, shEndM, shEndS, 0);

    // Night shift adjustment
    if (shEndH < shStartH || (shEndH === shStartH && shEndM <= shStartM)) {
      // shiftEnd is next day
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    // 3️⃣ Work date based on shiftStart
    const workDate = getISTDateString(shiftStart);

    // 4️⃣ Prevent multiple check-ins
    const checkSql = `SELECT * FROM attendance WHERE worker_id=? AND work_date=?`;
    db.query(checkSql, [worker_id, workDate], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length > 0)
        return res.status(400).json({ error: "Already checked in today", success: false });

      // 5️⃣ Difference from shiftStart in minutes
      const diffMin = (nowIST - shiftStart) / 60000;

      // Too early: more than 1 hour before shift start
      if (diffMin < -60) {
        return res.status(400).json({
          error: `Too early for check-in — ${shift.shift_name} starts at ${shift.start_time}`,
          success: false,
        });
      }

      // Too late: more than 5 hours after shift start
      if (diffMin > 300) {
        return res.status(400).json({
          error: `Check-in denied. You are more than 5 hours late for the ${shift.shift_name} shift. Please contact your supervisor.`,
          success: false,
        });
      }

      // 6️⃣ Determine status
      let status = "On time";
      if (diffMin > 15) status = "Late";

      // 7️⃣ Insert attendance
      const insertSql = `
        INSERT INTO attendance (worker_id, checkin_time, work_date, shift_id, status)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.query(
        insertSql,
        [worker_id, formatDateTimeForMySQL(nowIST), workDate, shift.shift_id, status],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            message: `Check-in successful (${shift.shift_name})`,
            success: true,
            shift_name: shift.shift_name,
            status,
            checkin_time: formatDateTimeForMySQL(nowIST),
            work_date: workDate,
          });
        }
      );
    });
  });
});


// ---------------- CHECK-OUT (Shift-Based, Fixed for Night Shifts) ----------------
app.post("/checkout", (req, res) => {
  const { worker_id, role } = req.body;
  if (role !== "worker")
    return res.status(403).json({ error: "Only workers can check out", success: false });

  const nowIST = getNowIST();

  const fetchSql = `
    SELECT a.*, s.start_time, s.end_time
    FROM attendance a
    JOIN shifts s ON a.shift_id = s.id
    WHERE a.worker_id=? AND a.checkout_time IS NULL
    ORDER BY a.id DESC
    LIMIT 1
  `;

  db.query(fetchSql, [worker_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0)
      return res.status(400).json({ error: "No active check-in found", success: false });

    const attendance = rows[0];
    const checkinTime = new Date(attendance.checkin_time);

    // 1️⃣ Calculate shift end correctly for night shifts
    const [shStartH, shStartM] = attendance.start_time.split(":").map(Number);
    const [shEndH, shEndM] = attendance.end_time.split(":").map(Number);

    let shiftEnd = new Date(checkinTime);
    shiftEnd.setHours(shEndH, shEndM, 0, 0);

    // Night shift: end < start → shiftEnd next day
    if (shEndH < shStartH || (shEndH === shStartH && shEndM <= shStartM)) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    // 2️⃣ Calculate worked hours
    const hoursWorked = parseFloat(((nowIST - checkinTime) / 3600000).toFixed(2));

    // 3️⃣ Determine overtime or early leave
    let overtime = 0;
    let status = attendance.status; // preserve original status

    if (nowIST > shiftEnd) {
      overtime = parseFloat(((nowIST - shiftEnd) / 3600000).toFixed(2));
    } else if (nowIST < shiftEnd) {
      status = "Left early";
    }

    // 4️⃣ Update attendance record
    const updateSql = `
      UPDATE attendance
      SET checkout_time=?, hours_worked=?, overtime_hours=?, status=?
      WHERE id=?
    `;
    db.query(
      updateSql,
      [formatDateTimeForMySQL(nowIST), hoursWorked, overtime, status, attendance.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          message: "Check-out successful",
          success: true,
          checkin_time: attendance.checkin_time,
          checkout_time: nowIST,
          hours_worked: hoursWorked,
          overtime_hours: overtime,
          status,
        });
      }
    );
  });
});


// ---------------- LEAVE REQUESTS ----------------
app.post("/leave-request", (req, res) => {
  const { worker_id, reason, from_date, to_date } = req.body;
  if (!worker_id || !reason || !from_date || !to_date) {
    return res.status(400).json({ message: "All fields are required", success: false });
  }

  const sql = `
    INSERT INTO leave_requests (worker_id, reason, from_date, to_date, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `;
  db.query(sql, [worker_id, reason, from_date, to_date], (err) => {
    if (err) return res.status(500).json({ message: "Database error", success: false });

    transporter.sendMail(
      {
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: `Leave Request from ${worker_id}`,
        text: `Worker ${worker_id} requested leave from ${from_date} to ${to_date}.\nReason: ${reason}`,
      },
      (err) => {
        if (err) console.error("Leave email error:", err.message);
      }
    );

    res.json({ message: "Leave request submitted successfully ✅", success: true });
  });
});

app.get("/leave-requests", (req, res) => {
  if (req.query.role !== "admin")
    return res.status(403).json({ error: "Only admin can view requests" });
  const sql = "SELECT * FROM leave_requests ORDER BY id DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post("/leave-requests/:id", (req, res) => {
  if (req.query.role !== "admin")
    return res.status(403).json({ error: "Only admin can update requests" });
  const { status } = req.body;
  if (!["Approved", "Rejected"].includes(status))
    return res.status(400).json({ error: "Invalid status" });

  db.query(
    "UPDATE leave_requests SET status=? WHERE id=?",
    [status, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: "Request not found" });

      res.json({ message: `Request ${status}`, success: true });
    }
  );
});

// ---------------- ADMIN USER MANAGEMENT ----------------
app.post("/users", (req, res) => {
  const { worker_id, password, role, job, email } = req.body;
  if (!worker_id || !password || !role)
    return res.status(400).json({ error: "worker_id, password, role required" });
  if (req.query.role !== "admin")
    return res.status(403).json({ error: "Only admin can add users" });

  db.query(
    "INSERT INTO users (worker_id, password, role, job, email) VALUES (?, ?, ?, ?, ?)",
    [worker_id, password, role, job || null, email || null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "User added successfully", success: true });
    }
  );
});

app.delete("/users/:id", (req, res) => {
  if (req.query.role !== "admin")
    return res.status(403).json({ error: "Only admin can delete users" });
  db.query("DELETE FROM users WHERE worker_id=?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User removed successfully", success: true });
  });
});

// Fetch all workers (for payroll dropdown)
app.get("/users", (req, res) => {
  const sql = "SELECT worker_id, job FROM users WHERE role='worker'";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results); // returns an array of workers
  });
});


// ---------------- ATTENDANCE FETCH ----------------
app.get("/attendance/:worker_id", (req, res) => {
  const { worker_id } = req.params;
  const sql = `
    SELECT a.*, u.job, u.role
    FROM attendance a
    JOIN users u ON a.worker_id = u.worker_id
    WHERE a.worker_id = ?
    ORDER BY a.work_date DESC
  `;
  db.query(sql, [worker_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ---------------- REPORT ----------------
app.get("/report", (req, res) => { const { worker_id, role } = req.query; 
let sql = "SELECT a.*, u.job, u.role FROM attendance a JOIN users u ON a.worker_id = u.worker_id"; 
const params = []; if (role === "worker" && worker_id) { sql += " WHERE a.worker_id = ?"; 
params.push(worker_id); } sql += " ORDER BY a.work_date DESC, a.checkin_time ASC"; 
db.query(sql, params, (err, results) => { if (err) return res.status(500).json({ error: err.message }); 
res.json(results); }); });


// ---------------- SALARY SUMMARY ----------------
app.get("/salary-summary", (req, res) => {
  const { worker_id, month, year } = req.query;

  let sql = `
    SELECT 
      a.worker_id, 
      u.job, 
      COUNT(a.id) AS present_days,
      SUM(IF(a.status='On time' OR a.status='Late', 1, 0)) AS worked_days,
      SUM(IF(a.status='Late',1,0)) AS late_days,
      SUM(IF(a.status='Left early',1,0)) AS early_leave_days,
      SUM(a.hours_worked) AS total_hours,
      SUM(a.overtime_hours) AS total_overtime
    FROM attendance a
    JOIN users u ON a.worker_id = u.worker_id
    WHERE 1=1
  `;

  const params = [];

  // ✅ Filter by worker_id if provided
  if (worker_id) {
    sql += " AND a.worker_id = ?";
    params.push(worker_id);
  }

  // ✅ Filter by month/year if given
  if (month && year) {
    sql += " AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?";
    params.push(month, year);
  }

  sql += " GROUP BY a.worker_id";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const dailyWage = 300;
    const overtimeRate = 10;

    const summary = results.map(r => {
      const totalHours = Number(r.total_hours) || 0;
      const totalOvertime = Number(r.total_overtime) || 0;
      const baseSalary = (Number(r.worked_days) || 0) * dailyWage;
      const overtimeAmount = totalOvertime * overtimeRate;
      const totalSalary = baseSalary + overtimeAmount;

      return {
        workerId: r.worker_id,
        job: r.job,
        presentDays: Number(r.present_days) || 0,
        workedDays: Number(r.worked_days) || 0,
        lateDays: Number(r.late_days) || 0,
        earlyLeaveDays: Number(r.early_leave_days) || 0,
        totalHours: totalHours.toFixed(2),
        totalOvertime: totalOvertime.toFixed(2),
        baseSalary: baseSalary.toFixed(2),
        overtimeAmount: overtimeAmount.toFixed(2),
        totalSalary: totalSalary.toFixed(2),
        month: month || null,
        year: year || null
      };
    });

    res.json({ success: true, data: summary });
  });
});


// ---------------- PAYROLL ANALYTICS ----------------
app.get("/payroll", (req, res) => {
  const workerId = req.query.worker_id;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  let sql = `
    SELECT 
      a.worker_id,
      w.job,
      COUNT(DISTINCT a.work_date) AS worked_days,
      ROUND(SUM(a.hours_worked), 2) AS total_hours,
      ROUND(SUM(a.overtime_hours), 2) AS total_overtime
    FROM attendance a
    INNER JOIN users w ON a.worker_id = w.worker_id
    WHERE MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?
  `;

  const params = [currentMonth, currentYear];

  if (workerId) {
    sql += " AND a.worker_id = ?";
    params.push(workerId);
  }

  sql += " GROUP BY a.worker_id, w.job ORDER BY a.worker_id;";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Error fetching payroll data:", err);
      return res.status(500).json({ error: "Error fetching payroll data" });
    }

    if (!rows.length) {
      return res.json({ message: "No data found for this month", data: [] });
    }

    const results = rows.map(r => {
      const totalHours = Number(r.total_hours) || 0;
      const totalOvertime = Number(r.total_overtime) || 0;
      const workedDays = Number(r.worked_days) || 0;

      return {
        worker_id: r.worker_id,
        job: r.job,
        workedDays,
        totalHours,
        totalOvertime,
        salary: Number(((totalHours * 100) + (totalOvertime * 50)).toFixed(2))
      };
    });

    res.json({
      month: currentMonth,
      year: currentYear,
      data: results
    });
  });
});



// ---------------- DAILY SHIFT REMINDERS ----------------
const sendShiftReminder = (shiftName, hour, minute) => {
  const cronTime = `${minute} ${hour} * * *`; // minute hour every day
  cron.schedule(
    cronTime,
    () => {
      console.log(`⏰ Running ${shiftName} reminder at ${hour}:${minute} IST`);
      const today = getISTDateString();

      const sql = `
        SELECT u.worker_id, u.job, u.email
        FROM users u
        JOIN shifts s ON u.shift_id = s.id
        WHERE u.role='worker' AND s.shift_name = ?
          AND u.worker_id NOT IN (
            SELECT worker_id FROM attendance WHERE work_date = ?
          )
      `;

      db.query(sql, [shiftName, today], (err, workers) => {
        if (err) return console.error("Error fetching absent workers:", err.message);
        if (!workers.length) return console.log(`✅ All ${shiftName} workers checked in today.`);

        workers.forEach((worker) => {
          if (worker.email) {
            transporter.sendMail(
              {
                from: process.env.GMAIL_USER,
                to: worker.email,
                subject: `Reminder: Please Check-In (${shiftName})`,
                text: `Hello ${worker.worker_id}, you haven’t checked in yet for ${shiftName} today (${today}). Please check in.`,
              },
              (err) => {
                if (err) console.error("Email error:", err.message);
                else console.log(`📩 Reminder sent to ${worker.worker_id} (${shiftName})`);
              }
            );
          }
        });
      });
    },
    { timezone: "Asia/Kolkata" }
  );
};

// ---------------- SCHEDULE REMINDERS ----------------
// Shift 1 → 9:30 AM
sendShiftReminder("Shift 1", 9, 30);

// Shift 2 → 10:00 PM
sendShiftReminder("Shift 2", 22, 0);


app.get("/analytics", (req, res) => {
  const sql = "SELECT * FROM attendance ORDER BY work_date ASC";

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to load analytics" });
    }

    let totalHours = 0;
    let totalLate = 0;
    let totalCheckins = 0;

    const labelsMap = {};
    const hoursPerDay = [];
    const latePerDay = [];
    const checkinsPerDay = [];

    rows.forEach((row) => {
      const hoursWorked = Number(row.hours_worked) || 0;
      totalHours += hoursWorked;

      if (row.status && row.status.toLowerCase() === "late") totalLate++;
      totalCheckins++;

      // ✅ Normalize MySQL DATETIME or DATE properly
      let dateLabel = "-";
      if (row.work_date) {
        try {
          const d = new Date(row.work_date);
          if (!isNaN(d)) {
            // Format as YYYY-MM-DD
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            dateLabel = `${yyyy}-${mm}-${dd}`;
          }
        } catch {
          dateLabel = "-";
        }
      }

      if (!(dateLabel in labelsMap)) {
        labelsMap[dateLabel] = hoursPerDay.length;
        hoursPerDay.push(0);
        latePerDay.push(0);
        checkinsPerDay.push(0);
      }

      const index = labelsMap[dateLabel];
      hoursPerDay[index] += hoursWorked;
      latePerDay[index] += row.status && row.status.toLowerCase() === "late" ? 1 : 0;
      checkinsPerDay[index] += 1;
    });

    const labels = Object.keys(labelsMap).filter(l => l !== "-"); // remove invalid ones

    res.json({
      totalHours,
      totalLate,
      totalCheckins,
      labels,
      hoursPerDay,
      latePerDay,
      checkinsPerDay
    });
  });
});


// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
