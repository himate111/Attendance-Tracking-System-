import React, { useState, useEffect } from "react";
import api from "../api/api"; // your axios instance

function MyAttendance() {
  const worker_id = localStorage.getItem("worker_id");
  const role = localStorage.getItem("role");

  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [leaveData, setLeaveData] = useState({ from_date: "", to_date: "", reason: "" });

  useEffect(() => {
    if (!worker_id || role !== "worker") {
      alert("Access denied. Please login as a worker.");
      window.location.href = "/login"; // your react route
      return;
    }

    const fetchAttendance = async () => {
      try {
        const res = await api.get(`/attendance/${worker_id}`);
        setAttendance(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load records");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [worker_id, role]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const calculateHoursAndStatus = (checkin, checkout, storedHours, storedStatus) => {
    if (!checkin || !checkout) return { hours: storedHours || "-", status: storedStatus || "-" };
    const diffMs = new Date(checkout) - new Date(checkin);
    if (diffMs < 0) return { hours: "0.00", status: "Late" };
    const hoursWorked = (diffMs / (1000 * 60 * 60)).toFixed(2);
    const status = hoursWorked >= 8 ? "On time" : "Late";
    return { hours: hoursWorked, status };
  };

  const handleLeaveSubmit = async () => {
    const { from_date, to_date, reason } = leaveData;
    if (!from_date || !to_date || !reason) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const res = await api.post("/leave-request", { worker_id, ...leaveData });
      alert(res.data.message);
      setShowModal(false);
      setLeaveData({ from_date: "", to_date: "", reason: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to submit leave request.");
    }
  };

  if (loading) return <p>Loading attendance...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Attendance Records</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
          {attendance.length === 0 ? (
            <tr>
              <td colSpan="7">No records found</td>
            </tr>
          ) : (
            attendance.map((record) => {
              const { hours, status } = calculateHoursAndStatus(
                record.checkin_time,
                record.checkout_time,
                record.hours_worked,
                record.status
              );
              return (
                <tr key={record.id}>
                  <td>{record.worker_id}</td>
                  <td>{record.job || "-"}</td>
                  <td>{formatDate(record.work_date)}</td>
                  <td>{formatTime(record.checkin_time)}</td>
                  <td>{formatTime(record.checkout_time)}</td>
                  <td>{hours}</td>
                  <td>{status}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <button onClick={() => setShowModal(true)}>Take Leave</button>
      <button onClick={() => window.history.back()}>Back</button>

      {showModal && (
        <div
          style={{
            position: "fixed",
            zIndex: 1000,
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", width: "300px" }}>
            <span style={{ float: "right", cursor: "pointer" }} onClick={() => setShowModal(false)}>
              &times;
            </span>
            <h3>Request Leave</h3>
            <input
              type="date"
              value={leaveData.from_date}
              onChange={(e) => setLeaveData({ ...leaveData, from_date: e.target.value })}
            />
            <input
              type="date"
              value={leaveData.to_date}
              onChange={(e) => setLeaveData({ ...leaveData, to_date: e.target.value })}
            />
            <textarea
              placeholder="Reason"
              value={leaveData.reason}
              onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })}
            />
            <button onClick={handleLeaveSubmit}>Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAttendance;
