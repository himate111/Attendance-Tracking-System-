import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import "../style/Analytics.css";

const Analytics = () => {
  const hoursChartRef = useRef(null);
  const lateChartRef = useRef(null);
  const checkinChartRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);

  // 🔹 Fetch analytics data from backend
  useEffect(() => {
    fetch("https://attendance-tracking-system-nu.vercel.app/analytics")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data))
      .catch((err) => console.error("Error loading analytics:", err));
  }, []);

  // 🔹 Render charts after data is loaded
  useEffect(() => {
    if (!analyticsData) return;

    // Destroy previous charts to avoid duplication
    Chart.getChart("hoursChart")?.destroy();
    Chart.getChart("lateChart")?.destroy();
    Chart.getChart("checkinChart")?.destroy();

    const { labels, hoursPerDay, checkinsPerDay, totalLate } = analyticsData;

    // 🗓️ Format labels like "Oct 21"
    const shortLabels = labels.map((dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr; // fallback for invalid dates
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    // 🔹 Hours worked bar chart
    new Chart(hoursChartRef.current, {
      type: "bar",
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: "Hours Worked",
            data: hoursPerDay,
            backgroundColor: "#45a29e",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#c5c6c7" } },
          y: { ticks: { color: "#c5c6c7" } },
        },
      },
    });

    // 🔹 On-time vs Late doughnut chart
    new Chart(lateChartRef.current, {
      type: "doughnut",
      data: {
        labels: ["On Time", "Late"],
        datasets: [
          {
            data: [analyticsData.totalCheckins - totalLate, totalLate],
            backgroundColor: ["#66fcf1", "#c3073f"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: "#c5c6c7" } } },
      },
    });

    // 🔹 Daily check-ins line chart
    new Chart(checkinChartRef.current, {
      type: "line",
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: "Daily Check-ins",
            data: checkinsPerDay,
            borderColor: "#66fcf1",
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#c5c6c7" } },
          y: { ticks: { color: "#c5c6c7" } },
        },
      },
    });
  }, [analyticsData]);

  return (
    <div className="analytics-wrapper">
      {/* Sidebar Toggle */}
      <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <h3>Dashboard</h3>
        <button
          className="sidebar-btn"
          onClick={() => (window.location.href = "/payroll")}
        >
          💼 Worker Payroll
        </button>
        <button
          className="sidebar-btn active"
          onClick={() => (window.location.href = "/analytics")}
        >
          📊 Analytics
        </button>
        <button
          className="sidebar-btn"
          onClick={() => (window.location.href = "/requests")}
        >
          📄 Requests
        </button>
        <button id="logoutBtn" className="sidebar-btn logout-btn">
          🚪 Logout
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="analytics-container">
        <h2>Attendance Analytics</h2>

        {analyticsData ? (
          <>
            <div className="stats-cards">
              <div className="card">
                <h3>Total Hours Worked</h3>
                <p>{analyticsData.totalHours.toFixed(2)}</p>
              </div>
              <div className="card">
                <h3>Total Late Arrivals</h3>
                <p>{analyticsData.totalLate}</p>
              </div>
              <div className="card">
                <h3>Total Check-ins</h3>
                <p>{analyticsData.totalCheckins}</p>
              </div>
            </div>

            <div className="chart-box">
              <h3>Hours Worked per Day</h3>
              <canvas id="hoursChart" ref={hoursChartRef}></canvas>
            </div>

            <div className="chart-box">
              <h3>On-time vs Late Arrival Ratio</h3>
              <canvas id="lateChart" ref={lateChartRef}></canvas>
            </div>

            <div className="chart-box">
              <h3>Daily Check-ins Overview</h3>
              <canvas id="checkinChart" ref={checkinChartRef}></canvas>
            </div>
          </>
        ) : (
          <p>Loading analytics...</p>
        )}
      </div>
    </div>
  );
};

export default Analytics;
