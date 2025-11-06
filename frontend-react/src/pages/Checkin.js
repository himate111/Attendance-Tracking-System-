// src/pages/Checkin.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Checkin.css";
import { FaUserClock, FaSignOutAlt, FaClipboardList, FaCalendarAlt } from "react-icons/fa";

const Checkin = () => {
  const [statusMsg, setStatusMsg] = useState("");
  const [checkInDisabled, setCheckInDisabled] = useState(false);
  const [checkOutDisabled, setCheckOutDisabled] = useState(true);
  const [workerId, setWorkerId] = useState("");
  const navigate = useNavigate();

  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  useEffect(() => {
    const storedWorkerId = localStorage.getItem("worker_id");
    const role = localStorage.getItem("role");

    if (!storedWorkerId || role !== "worker") {
      alert("Access denied. Please login as a worker.");
      navigate("/login");
      return;
    }

    setWorkerId(storedWorkerId);

    const fetchAttendance = async () => {
      try {
        const res = await fetch(`http://localhost:3000/attendance/${storedWorkerId}`);
        const records = await res.json();

        const last = records
          .sort((a, b) => new Date(b.work_date) - new Date(a.work_date))
          .find(r => !r.checkout_time);

        if (last) {
          setCheckInDisabled(true);
          setCheckOutDisabled(false);
          if (last.checkin_time) {
            setStatusMsg(`Checked in at ${formatTime(last.checkin_time)} (${last.status || "On time"})`);
          }
        } else {
          setCheckInDisabled(false);
          setCheckOutDisabled(true);
          setStatusMsg("");
        }
      } catch (err) {
        console.error(err);
        setStatusMsg("Failed to fetch attendance data.");
      }
    };

    fetchAttendance();
  }, [navigate]);

  const handleCheckIn = async () => {
    try {
      const res = await fetch("http://localhost:3000/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, role: "worker" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Checked in at ${formatTime(data.checkin_time)} (${data.status || "On time"})`);
        setCheckInDisabled(true);
        setCheckOutDisabled(false);
      } else {
        setStatusMsg(data.error || "Check-in failed.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("Check-in failed. Try again.");
    }
  };

  const handleCheckOut = async () => {
    try {
      const res = await fetch("http://localhost:3000/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, role: "worker" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Checked out at ${formatTime(data.checkout_time)}, Hours worked: ${data.hours_worked || 0}`);
        setCheckOutDisabled(true);
        setCheckInDisabled(false);
      } else {
        setStatusMsg(data.error || "Check-out failed.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("Check-out failed. Try again.");
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="sidebar-title">Worker Panel</h2>
        <button onClick={() => navigate("/myattendance")} className="sidebar-btn">
          <FaClipboardList /> View Attendance
        </button>
        <button onClick={() => navigate("/leave-request")} className="sidebar-btn">
          <FaCalendarAlt /> Leave Request
        </button>
        <button
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
          className="sidebar-btn logout-btn"
        >
          <FaSignOutAlt /> Logout
        </button>
      </aside>

      {/* Main Section */}
      <main className="main-content">
        <div className="checkin-card">
          <div className="card-header">
            <FaUserClock className="icon" />
            <h2>Welcome, Worker {workerId}</h2>
          </div>

          <div className="status-section">
            <p className="status-text">{statusMsg || "No active session yet."}</p>
          </div>

          <div className="button-section">
            <button
              className={`action-btn checkin ${checkInDisabled ? "disabled" : ""}`}
              onClick={handleCheckIn}
              disabled={checkInDisabled}
            >
              Check In
            </button>
            <button
              className={`action-btn checkout ${checkOutDisabled ? "disabled" : ""}`}
              onClick={handleCheckOut}
              disabled={checkOutDisabled}
            >
              Check Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkin;

