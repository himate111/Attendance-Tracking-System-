// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// ✅ Import all pages
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Checkin from "./pages/Checkin";
import MyAttendance from "./pages/MyAttendance";
import UserManagement from "./pages/UserManagement"; // ✅ Add when ready
import Payroll from './pages/Payroll';
import Analytics from './pages/Analytics'
import Requests from './pages/Requests';

function App() {
  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Admin Pages */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/usermanagement" element={<UserManagement />} /> {/* ✅ */}

        {/* Worker Pages */}
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/myattendance" element={<MyAttendance />} />


        <Route path="/payroll" element={<Payroll />} />
        <Route path="/analytics" element={<Analytics />} />

        <Route path="/requests" element={<Requests />}></Route>

        {/* Default Fallback (redirect to login) */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
