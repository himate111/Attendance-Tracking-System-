import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/style.css";
import workerIllustration from "../assets/worker.png"; // ✅ your saved image

const Login = () => {
  const [workerId, setWorkerId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: workerId, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data));
        localStorage.setItem("role", data.role);
        localStorage.setItem("worker_id", data.worker_id);

        if (data.role === "admin") navigate("/admin");
        else navigate("/checkin");
      } else {
        setMessage(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error connecting to server");
    }
  };

  return (
    <div className="login-page">
      {/* Left section with illustration */}
      <div className="login-left">
        <img src={workerIllustration} alt="Worker illustration" />
      </div>

      {/* Right section with form */}
      <div className="login-right">
        <div className="login-box">
          <h2>Login</h2>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Worker ID"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
              />
              <span className="icon">👤</span>
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="icon">🔒</span>
            </div>

            <div className="forgot-password">
              <a href="#">Forgot Password?</a>
            </div>

            <button type="submit" className="login-btn">
              Login
            </button>
          </form>

          {message && <p className="error-msg">{message}</p>}

        </div>
      </div>
    </div>
  );
};

export default Login;
