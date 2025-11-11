// src/pages/MyAttendance.js
import React, { useEffect, useState } from "react";
import "../style/MyAttendance.css";

const MyAttendance = () => {
  const workerId = localStorage.getItem("worker_id");
  const role = localStorage.getItem("role");

  const [attendance, setAttendance] = useState([]);
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const calculateHoursAndStatus = (checkin, checkout) => {
    if (!checkin || !checkout) return { hours: "-", status: "-" };
    const diff = (new Date(checkout) - new Date(checkin)) / (1000*60*60);
    return { hours: diff.toFixed(2), status: diff >= 8 ? "On time" : "Late" };
  };

  useEffect(() => {
    if (!workerId || role !== "worker") {
      alert("Access denied. Please login as a worker.");
      window.location.href = "/login";
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`https://attendance-tracking-system-nu.vercel.app/attendance/${workerId}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setAttendance(data);
      } catch (err) {
        console.error(err);
        setStatus("Failed to load attendance records.");
      }
    };

    fetchData();
  }, [workerId, role]);

  const handleLeaveSubmit = async () => {
    if (!fromDate || !toDate || !reason) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const res = await fetch("https://attendance-tracking-system-nu.vercel.app/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, from_date: fromDate, to_date: toDate, reason }),
      });
      const data = await res.json();
      alert(data.message || "Leave requested successfully!");
      setShowModal(false);
      setFromDate("");
      setToDate("");
      setReason("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit leave request.");
    }
  };

  return (
    <div className="myattendance-container">
      <h2>My Attendance Records</h2>

      {/* Table wrapper for blur effect */}
      <div className={`attendance-table-wrapper ${showModal ? "blurred" : ""}`}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Hours Worked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
  {attendance.length === 0 ? (
    <tr>
      <td colSpan="5">{status || "No records found"}</td>
    </tr>
  ) : (
    attendance.map((rec, idx) => {
      const { hours, status } = calculateHoursAndStatus(rec.checkin_time, rec.checkout_time);
      return (
        <tr key={idx} className={status === "Late" ? "late-row" : status === "On time" ? "ontime-row" : ""}>
          <td>{formatDate(rec.work_date)}</td>
          <td>{formatTime(rec.checkin_time)}</td>
          <td>{formatTime(rec.checkout_time)}</td>
          <td>{hours}</td>
          <td>{status}</td>
        </tr>
      );
    })
  )}
</tbody>

        </table>
      </div>

      <div className="attendance-buttons">
        <button onClick={() => setShowModal(true)}>Take Leave</button>
        <button onClick={() => window.history.back()}>Back</button>
      </div>

      {/* Leave Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Request Leave</h3>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="modal-buttons">
              <button onClick={handleLeaveSubmit}>Submit</button>
              <button onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;

