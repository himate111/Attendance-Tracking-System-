// src/pages/Requests.jsx
import React, { useEffect, useState } from "react";
import "../style/Requests.css"; // keep your CSS here
import { useNavigate } from "react-router-dom";

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}-${month}-${year}`;
  };

  const fetchRequests = async () => {
    try {
      const role = localStorage.getItem("role");
      if (!role || role !== "admin") {
        alert("Access denied!");
        navigate("/login");
        return;
      }

      const res = await fetch(`https://attendance-tracking-system-nu.vercel.app/leave-requests?role=admin`);
      if (!res.ok) throw new Error("Failed to load leave requests");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
      setRequests([]);
    }
  };

  const updateRequest = async (id, status) => {
    try {
      const res = await fetch(`https://attendance-tracking-system-nu.vercel.app/leave-requests/${id}?role=admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Request updated");
        fetchRequests();
      } else {
        alert(data.error || "Failed to update request");
      }
    } catch (err) {
      alert("Error updating request: " + err.message);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div className="sidebar">
        <h3>Dashboard</h3>
        <button className="sidebar-btn" onClick={() => navigate("/payroll")}>💼 Worker Payroll</button>
        <button className="sidebar-btn" onClick={() => navigate("/analytics")}>📊 Analytics</button>
        <button className="sidebar-btn" onClick={() => navigate("/requests")}>📄 Requests</button>
        <button
          id="logoutBtn"
          className="sidebar-btn"
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-container">
        <h2>Leave Requests</h2>
        <table id="requestsTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Worker ID</th>
              <th>Reason</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan="8">No leave requests found</td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td data-label="ID">{r.id}</td>
                  <td data-label="Worker ID">{r.worker_id}</td>
                  <td data-label="Reason">{r.reason}</td>
                  <td data-label="From">{formatDate(r.from_date)}</td>
                  <td data-label="To">{formatDate(r.to_date)}</td>
                  <td data-label="Status">
                    <span className={`status ${r.status}`}>{r.status}</span>
                  </td>
                  <td data-label="Created At">{formatDateTime(r.request_date)}</td>
                  <td data-label="Actions">
                    <button className="approve" onClick={() => updateRequest(r.id, "Approved")}>Approve</button>
                    <button className="reject" onClick={() => updateRequest(r.id, "Rejected")}>Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Requests;
