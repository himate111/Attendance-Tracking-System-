// src/pages/Checkin.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Checkin.css";

const Checkin = () => {
  const [statusMsg, setStatusMsg] = useState("");
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const navigate = useNavigate();

  // Helper to show readable IST time
  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    const parsed = new Date(dateStr);

    if (isNaN(parsed)) {
      const fixed = new Date(dateStr.replace(" ", "T") + "Z");
      if (isNaN(fixed)) return "-";
      return fixed.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    return parsed.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Load worker status on page load
  useEffect(() => {
    const storedWorkerId = localStorage.getItem("worker_id");
    const role = localStorage.getItem("role");

    if (!storedWorkerId || role !== "worker") {
      alert("Access denied. Please login as a worker.");
      navigate("/login");
      return;
    }

    setWorkerId(storedWorkerId);

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `https://attendance-tracking-system-nu.vercel.app/attendance/${storedWorkerId}`
        );

        const records = await res.json();

        if (!Array.isArray(records) || records.length === 0) {
          setHasCheckedIn(false);
          setStatusMsg("You have not checked in today.");
          return;
        }

        // 1️⃣ Check ACTIVE session (checkout_time is NULL)
        const active = records.find((r) => !r.checkout_time);

        if (active) {
          setHasCheckedIn(true);
          setStatusMsg(
            `Checked in at: ${formatTime(active.checkin_time)} (${active.status || "On time"})`
          );
          return;
        }

        // 2️⃣ Check if they already checked in today
        const today = new Date().toISOString().split("T")[0];
        const todayRecord = records.find((r) => r.work_date === today);

        if (todayRecord) {
          setHasCheckedIn(false);
          setStatusMsg("You already checked in today and checked out.");
        } else {
          setHasCheckedIn(false);
          setStatusMsg("You have not checked in today.");
        }
      } catch (err) {
        console.error(err);
        setStatusMsg("Failed to fetch attendance data.");
      }
    };

    fetchStatus();
  }, [navigate]);

  // Check-In
  const handleCheckIn = async () => {
    try {
      const res = await fetch(
        "https://attendance-tracking-system-nu.vercel.app/checkin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worker_id: workerId, role: "worker" }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setHasCheckedIn(true);
        setStatusMsg(
          `Checked in at: ${formatTime(data.checkin_time)} (${data.status || "On time"})`
        );
      } else {
        setStatusMsg(data.error || "Check-in failed.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("Check-in failed. Try again.");
    }
  };

  // Check-Out
  const handleCheckOut = async () => {
    try {
      const res = await fetch(
        "https://attendance-tracking-system-nu.vercel.app/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worker_id: workerId, role: "worker" }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setHasCheckedIn(false);
        setStatusMsg(
          `Checked out at: ${formatTime(data.checkout_time)}, Hours worked: ${
            data.hours_worked || 0
          }`
        );
      } else {
        setStatusMsg(data.error || "Check-out failed.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("Check-out failed. Try again.");
    }
  };

  const handleViewAttendance = () => navigate("/myattendance");

  const handleLogout = () => {
    localStorage.removeItem("worker_id");
    localStorage.removeItem("role");
    localStorage.removeItem("job");
    navigate("/login");
  };

  return (
    <div className="checkin-container">
      <h2>Check-In Page</h2>
      <p>Welcome, Worker {workerId}!</p>

      {/* Buttons */}
      {!hasCheckedIn ? (
        <button onClick={handleCheckIn}>Check In</button>
      ) : (
        <button onClick={handleCheckOut}>Check Out</button>
      )}

      <p style={{ marginTop: "10px" }}>{statusMsg}</p>

      <button onClick={handleViewAttendance}>View My Attendance</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Checkin;
