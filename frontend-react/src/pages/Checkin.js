// src/pages/Checkin.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Checkin.css";

const Checkin = () => {
  const [statusMsg, setStatusMsg] = useState("");
  const [checkInDisabled, setCheckInDisabled] = useState(false);
  const [checkOutDisabled, setCheckOutDisabled] = useState(true);
  const [workerId, setWorkerId] = useState("");
  const navigate = useNavigate();

  // Format time helper
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

    const setButtonState = async () => {
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
            setStatusMsg(`Checked in at: ${formatTime(last.checkin_time)} (${last.status || "On time"})`);
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

    setButtonState();
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
        setStatusMsg(`Checked in at: ${formatTime(data.checkin_time)} (${data.status || "On time"})`);
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
        setStatusMsg(`Checked out at: ${formatTime(data.checkout_time)}, Hours worked: ${data.hours_worked || 0}`);
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

  const handleViewAttendance = () => {
    navigate("/myattendance"); // Create this page later
  };

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
      <button onClick={handleCheckIn} disabled={checkInDisabled}>Check In</button>
      <button onClick={handleCheckOut} disabled={checkOutDisabled}>Check Out</button>
      <p>{statusMsg}</p>
      <button onClick={handleViewAttendance}>View My Attendance</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Checkin;
