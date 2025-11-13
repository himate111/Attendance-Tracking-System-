import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";  // ✅ import navigate hook
import "../style/UserManagement.css";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [workerId, setWorkerId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [job, setJob] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate(); // ✅ initialize navigate

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
  try {
    const res = await fetch("https://attendance-tracking-system-nu.vercel.app/users/all");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Error fetching users:", err);
    setMessage("❌ Error loading users");
  }
};


  const addUser = async () => {
    if (!workerId || !password || !role) {
      showMessage("⚠️ Worker ID, Password, and Role are required.", "error");
      return;
    }

    try {
      const res = await fetch("https://attendance-tracking-system-nu.vercel.app/users?role=admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, password, role, job, email }),
      });

      const data = await res.json();

      if (data.success) {
        showMessage("✅ User added successfully!", "success");
        clearForm();
        loadUsers();
      } else {
        showMessage("❌ " + (data.error || "Failed to add user."), "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("❌ Network error while adding user.", "error");
    }
  };

  const deleteUser = async (worker_id) => {
    if (!window.confirm(`Are you sure you want to delete ${worker_id}?`)) return;

    try {
      const res = await fetch(`https://attendance-tracking-system-nu.vercel.app/users/${worker_id}?role=admin`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showMessage("🗑️ User deleted successfully.", "success");
        loadUsers();
      } else {
        showMessage("❌ " + (data.error || "Failed to delete user."), "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("❌ Network error while deleting user.", "error");
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  const clearForm = () => {
    setWorkerId("");
    setPassword("");
    setRole("");
    setJob("");
    setEmail("");
  };

  return (
    <div className="user-page">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="sidebar-title">Admin Panel</h2>
        <button onClick={() => navigate("/admin")}>🏠 Dashboard</button>
        <button onClick={() => navigate("/payroll")}>💰 Payroll</button>
        <button onClick={() => navigate("/analytics")}>📊 Analytics</button>
        <button className="active">👥 User Management</button>
        <button className="logout" onClick={() => navigate("/")}>Logout</button>
      </div>

      {/* Main Content */}
      <div className="user-content">
        <div className="user-container">
          <h1 className="user-heading">👷‍♂️ User Management</h1>

          <div className="form-row">
            <input type="text" placeholder="Worker ID" value={workerId} onChange={(e) => setWorkerId(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select Role</option>
              <option value="admin">Admin</option>
              <option value="worker">Worker</option>
            </select>
            <input type="text" placeholder="Job Title (Optional)" value={job} onChange={(e) => setJob(e.target.value)} />
            <input type="email" placeholder="Email (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={addUser}>Add User</button>
          </div>

          {message && <p className="message">{message}</p>}

          <table className="user-table">
            <thead>
              <tr>
                <th>Worker ID</th>
                <th>Role</th>
                <th>Job</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.worker_id}>
                    <td>{u.worker_id}</td>
                    <td>{u.role || "worker"}</td>
                    <td>{u.job || "-"}</td>
                    <td>{u.email || "-"}</td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteUser(u.worker_id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
