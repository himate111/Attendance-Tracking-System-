// src/pages/Login.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/style.css";

const Login = () => {
  const [workerId, setWorkerId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("https://attendance-tracking-system-nu.vercel.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, password }),
      });

      const data = await res.json();

      if (data.success) {
        // Save user info and role
        localStorage.setItem("user", JSON.stringify(data));
        localStorage.setItem("role", data.role);
        localStorage.setItem("worker_id", data.worker_id);

        // Redirect based on role
        if (data.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/checkin"); // you'll create WorkerDashboard later
        }
      } else {
        setMessage(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error connecting to server");
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <label>Worker ID</label>
        <input
          type="text"
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {message && <p style={{ marginTop: "15px", color: "red" }}>{message}</p>}
    </div>
  );
};

export default Login;
