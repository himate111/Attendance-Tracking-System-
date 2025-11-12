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
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "https://attendance-tracking-system-nu.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
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
app.post("/login", async(req, res) => {
  const { worker_id, password } = req.body;
  console.log("Login request:", req.body);
  try{
      const [results] = await db.query(
        "SELECT * FROM users WHERE worker_id = ? AND password = ?",
        [worker_id, password]
      );
      console.log("DB query results:", results);

      if (results.length === 0){
        console.warn("Invalid credentials for", worker_id);
        return res.status(401).json({ error: "Invalid credentials", success: false });
      }
  
      const user = results[0];
      res.json({
        worker_id: user.worker_id,
        role: user.role,
        job: user.job,
        email: user.email,
        success: true,
      });
  } catch (err) {
    console.error("Login query error:", err);
    return res.status(500).json({ error: err.message, success: false });
  }
});

// ---------------CHECK IN------------------

app.post("/checkin", async (req, res) => {
  try {
    const { worker_id, role } = req.body;

    if (role !== "worker") {
      return res.status(403).json({ error: "Only workers can check in", success: false });
    }

    const nowIST = getNowIST(); // Current IST time

    // 1️⃣ Get worker’s assigned shift
    const shiftQuery = `
      SELECT s.id AS shift_id, s.shift_name, s.start_time, s.end_time
      FROM users u
      JOIN shifts s ON u.shift_id = s.id
      WHERE u.worker_id = ?
    `;
    const [shiftResults] = await db.query(shiftQuery, [worker_id]);

    if (shiftResults.length === 0) {
      return res.status(404).json({ error: "Shift not found for this worker" });
    }

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
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    // 3️⃣ Work date based on shiftStart
    const workDate = getISTDateString(shiftStart);

    // 4️⃣ Prevent multiple check-ins
    const checkSql = `SELECT * FROM attendance WHERE worker_id=? AND work_date=?`;
    const [existingCheck] = await db.query(checkSql, [worker_id, workDate]);

    if (existingCheck.length > 0) {
      return res.status(400).json({ error: "Already checked in today", success: false });
    }

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
    await db.query(insertSql, [worker_id, formatDateTimeForMySQL(nowIST), workDate, shift.shift_id, status]);

    //  Send response
    res.json({
      message: `Check-in successful (${shift.shift_name})`,
      success: true,
      shift_name: shift.shift_name,
      status,
      checkin_time: formatDateTimeForMySQL(nowIST),
      work_date: workDate,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- CHECK-OUT (Shift-Based, Fixed for Night Shifts) ----------------

app.post("/checkout", async (req, res) => {
  try {
    const { worker_id, role } = req.body;
    if (role !== "worker") {
      return res.status(403).json({ error: "Only workers can check out", success: false });
    }

    const nowIST = getNowIST();

    const fetchSql = `
      SELECT a.*, s.start_time, s.end_time
      FROM attendance a
      JOIN shifts s ON a.shift_id = s.id
      WHERE a.worker_id=? AND a.checkout_time IS NULL
      ORDER BY a.id DESC
      LIMIT 1
    `;
    const [rows] = await db.query(fetchSql, [worker_id]);

    if (rows.length === 0) {
      return res.status(400).json({ error: "No active check-in found", success: false });
    }

    const attendance = rows[0];
    const checkinTime = new Date(attendance.checkin_time);

    // 1️⃣ Calculate shift end correctly for night shifts
    const [shStartH, shStartM] = attendance.start_time.split(":").map(Number);
    const [shEndH, shEndM] = attendance.end_time.split(":").map(Number);

    let shiftEnd = new Date(checkinTime);
    shiftEnd.setHours(shEndH, shEndM, 0, 0);

    // Night shift adjustment
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
    await db.query(updateSql, [formatDateTimeForMySQL(nowIST), hoursWorked, overtime, status, attendance.id]);

    res.json({
      message: "Check-out successful",
      success: true,
      checkin_time: attendance.checkin_time,
      checkout_time: nowIST,
      hours_worked: hoursWorked,
      overtime_hours: overtime,
      status,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- LEAVE REQUESTS ----------------
// 1️⃣ Submit leave request
app.post("/leave-request", async (req, res) => {
  try {
    const { worker_id, reason, from_date, to_date } = req.body;
    if (!worker_id || !reason || !from_date || !to_date) {
      return res.status(400).json({ message: "All fields are required", success: false });
    }

    const sql = `
      INSERT INTO leave_requests (worker_id, reason, from_date, to_date, status)
      VALUES (?, ?, ?, ?, 'Pending')
    `;
    await db.query(sql, [worker_id, reason, from_date, to_date]);

    // Send notification email (non-blocking)
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
  } catch (err) {
    res.status(500).json({ message: "Database error", success: false });
  }
});

// 2️⃣ Get all leave requests (admin only)
app.get("/leave-requests", async (req, res) => {
  try {
    if (req.query.role !== "admin") {
      return res.status(403).json({ error: "Only admin can view requests" });
    }

    const sql = "SELECT * FROM leave_requests ORDER BY id DESC";
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Update leave request status (admin only)
app.post("/leave-requests/:id", async (req, res) => {
  try {
    if (req.query.role !== "admin") {
      return res.status(403).json({ error: "Only admin can update requests" });
    }

    const { status } = req.body;
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [result] = await db.query(
      "UPDATE leave_requests SET status=? WHERE id=?",
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ message: `Request ${status}`, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- ADMIN USER MANAGEMENT ----------------
// 1️⃣ Add a new user (admin only)
app.post("/users", async (req, res) => {
  try {
    const { worker_id, password, role, job, email } = req.body;
    if (!worker_id || !password || !role) {
      return res.status(400).json({ error: "worker_id, password, role required" });
    }
    if (req.query.role !== "admin") {
      return res.status(403).json({ error: "Only admin can add users" });
    }

    const sql = "INSERT INTO users (worker_id, password, role, job, email) VALUES (?, ?, ?, ?, ?)";
    await db.query(sql, [worker_id, password, role, job || null, email || null]);

    res.json({ message: "User added successfully", success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Delete a user (admin only)
app.delete("/users/:id", async (req, res) => {
  try {
    if (req.query.role !== "admin") {
      return res.status(403).json({ error: "Only admin can delete users" });
    }

    const sql = "DELETE FROM users WHERE worker_id=?";
    const [result] = await db.query(sql, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User removed successfully", success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Fetch all workers (for payroll dropdown)
app.get("/users", async (req, res) => {
  try {
    const sql = "SELECT worker_id, job FROM users WHERE role='worker'";
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- ATTENDANCE FETCH ----------------
app.get("/attendance/:worker_id", async (req, res) => {
  try {
    const { worker_id } = req.params;
    const sql = `
      SELECT a.*, u.job, u.role
      FROM attendance a
      JOIN users u ON a.worker_id = u.worker_id
      WHERE a.worker_id = ?
      ORDER BY a.work_date DESC
    `;
    const [results] = await db.query(sql, [worker_id]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- REPORT ----------------
app.get("/report", async (req, res) => {
  try {
    const { worker_id, role } = req.query;

    let sql = `
      SELECT a.*, u.job, u.role
      FROM attendance a
      JOIN users u ON a.worker_id = u.worker_id
    `;
    const params = [];

    if (role === "worker" && worker_id) {
      sql += " WHERE a.worker_id = ?";
      params.push(worker_id);
    }

    sql += " ORDER BY a.work_date DESC, a.checkin_time ASC";

    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- SALARY SUMMARY ----------------
app.get("/salary-summary", async (req, res) => {
  try {
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

    if (worker_id) {
      sql += " AND a.worker_id = ?";
      params.push(worker_id);
    }

    if (month && year) {
      sql += " AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?";
      params.push(month, year);
    }

    sql += " GROUP BY a.worker_id";

    const [results] = await db.query(sql, params);

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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ---------------- PAYROLL ANALYTICS ----------------
app.get("/payroll", async (req, res) => {
  try {
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

    const [rows] = await db.query(sql, params);

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

  } catch (err) {
    console.error("❌ Error fetching payroll data:", err);
    res.status(500).json({ error: "Error fetching payroll data" });
  }
});


// ---------------- DAILY SHIFT REMINDERS ----------------
const sendShiftReminder = (shiftName, hour, minute) => {
  const cronTime = `${minute} ${hour} * * *`; // minute hour every day
  cron.schedule(
    cronTime,
    async () => {
      try {
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

        const [workers] = await db.query(sql, [shiftName, today]);

        if (!workers.length) {
          return console.log(`✅ All ${shiftName} workers checked in today.`);
        }

        for (const worker of workers) {
          if (worker.email) {
            try {
              await transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: worker.email,
                subject: `Reminder: Please Check-In (${shiftName})`,
                text: `Hello ${worker.worker_id}, you haven’t checked in yet for ${shiftName} today (${today}). Please check in.`,
              });
              console.log(`📩 Reminder sent to ${worker.worker_id} (${shiftName})`);
            } catch (err) {
              console.error("Email error:", err.message);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching absent workers:", err.message);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};
// Schedule reminders for shifts
sendShiftReminder("Shift 1", 9, 30);  // 9:30 AM
sendShiftReminder("Shift 2", 22, 0);  // 10:00 PM
app.get("/analytics", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM attendance ORDER BY work_date ASC");

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

      // Normalize MySQL DATE/DATETIME
      let dateLabel = "-";
      if (row.work_date) {
        const d = new Date(row.work_date);
        if (!isNaN(d)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dateLabel = `${yyyy}-${mm}-${dd}`;
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

    const labels = Object.keys(labelsMap).filter(l => l !== "-");

    res.json({
      totalHours,
      totalLate,
      totalCheckins,
      labels,
      hoursPerDay,
      latePerDay,
      checkinsPerDay
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});



// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
