// src/pages/AdminDashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ import this
import "../style/AdminDashboard.css";

const AdminDashboard = () => {
  const [fullData, setFullData] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [role, setRole] = useState(localStorage.getItem("role"));

  const navigate = useNavigate(); // ✅ initialize navigate here

  // ---------------- HELPERS ----------------
  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: true,
    });
  };

  const toISTDateString = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };

  const computeHoursWorked = (checkin, checkout) => {
    if (!checkin || !checkout) return null;
    const start = new Date(checkin).getTime();
    const end = new Date(checkout).getTime();
    let diff = end - start;
    if (diff < 0) diff = 0;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { hours, minutes, seconds };
  };

  const formatDuration = (duration) => {
    if (!duration) return "-";
    return `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`;
  };

  const getAttendanceClass = (record) => {
    if (!record.checkin_time || !record.checkout_time) return "pending";
    const [startHour, startMinute] = record.shift_start
      ? record.shift_start.split(":").map(Number)
      : [9, 0];
    const [endHour, endMinute] = record.shift_end
      ? record.shift_end.split(":").map(Number)
      : [17, 0];

    const shiftStart = new Date(
      toISTDateString(record.work_date) + "T00:00:00"
    );
    shiftStart.setHours(startHour, startMinute, 0, 0);
    const shiftEnd = new Date(toISTDateString(record.work_date) + "T00:00:00");
    shiftEnd.setHours(endHour, endMinute, 0, 0);

    const checkin = new Date(record.checkin_time);
    const checkout = new Date(record.checkout_time);

    if (checkin > shiftStart) return "late";
    if (checkout < shiftEnd) return "early";
    return "on-time";
  };

  const getDailyRecords = (data) => {
    const map = {};
    data.forEach((r) => {
      const dateKey = toISTDateString(r.work_date) + r.worker_id;
      if (!map[dateKey]) map[dateKey] = { ...r };
      else {
        if (
          r.checkin_time &&
          (!map[dateKey].checkin_time ||
            new Date(r.checkin_time) < new Date(map[dateKey].checkin_time))
        ) {
          map[dateKey].checkin_time = r.checkin_time;
          map[dateKey].status = r.status;
        }
        if (
          r.checkout_time &&
          (!map[dateKey].checkout_time ||
            new Date(r.checkout_time) > new Date(map[dateKey].checkout_time))
        ) {
          map[dateKey].checkout_time = r.checkout_time;
        }
      }
    });
    return Object.values(map).sort(
      (a, b) => new Date(b.work_date) - new Date(a.work_date)
    );
  };

  // ---------------- FETCH REPORT ----------------
  const fetchReport = async () => {
    try {
      const query = new URLSearchParams({
        role,
        worker_id: localStorage.getItem("worker_id"),
      });
      const res = await fetch(`https://attendance-tracking-system-nu.vercel.app/report?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data = await res.json();
      setFullData(data);
      filterByDate(selectedDate, data);
    } catch (err) {
      console.error("Error fetching report:", err);
    }
  };

  const filterByDate = (date, allData = fullData) => {
    const filtered = allData.filter(
      (r) => toISTDateString(r.work_date) === date
    );
    setReportData(filtered);
  };

  // ---------------- EFFECT ----------------
  useEffect(() => {
    if (!role || role !== "admin") {
      alert("Access denied!");
      navigate("/login"); // ✅ SPA navigation (no reload)
      return;
    }
    fetchReport();
  }, [role]);

  // ---------------- RENDER ----------------
  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <h3>Dashboard</h3>
        <button className="sidebar-btn" onClick={() => navigate("/usermanagement")}>
          👥 User Management
        </button>
        <button className="sidebar-btn" onClick={() => navigate("/payroll")}>
          💼 Worker Payroll
        </button>
        <button className="sidebar-btn" onClick={() => navigate("/analytics")}>
          📊 Analytics
        </button>
        <button className="sidebar-btn" onClick={() => navigate("/requests")}>
          📄 Requests
        </button>
        <button
          className="sidebar-btn logout-btn"
          onClick={() => {
            localStorage.clear();
            navigate("/login"); // ✅ SPA redirect
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-container">
        <h2 className="report">Attendance Report</h2>
        <div className="filter-bar">
          <label htmlFor="reportDate">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              filterByDate(e.target.value);
            }}
          />
        </div>

        <table className="tablehead">
          <thead>
            <tr>
              <th>Worker ID</th>
              <th>Job</th>
              <th>Date</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Hours Worked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {getDailyRecords(reportData).length === 0 ? (
              <tr>
                <td colSpan="7">No records found</td>
              </tr>
            ) : (
              getDailyRecords(reportData).map((r, idx) => {
                const cls = getAttendanceClass(r);
                const duration = computeHoursWorked(r.checkin_time, r.checkout_time);
                const hoursDisplay = formatDuration(duration);
                let statusDisplay = "Pending";
                if (r.checkin_time && r.checkout_time) {
                  statusDisplay =
                    cls === "late"
                      ? "Late"
                      : cls === "early"
                      ? "Early"
                      : "On-Time";
                }
                return (
                  <tr key={idx} className={cls}>
                    <td>{r.worker_id || "-"}</td>
                    <td>{r.job || "-"}</td>
                    <td>{r.work_date ? toISTDateString(r.work_date) : "-"}</td>
                    <td>{formatTime(r.checkin_time)}</td>
                    <td>{formatTime(r.checkout_time)}</td>
                    <td>{hoursDisplay}</td>
                    <td>{statusDisplay}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;


