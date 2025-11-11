// src/pages/Payroll.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import "../style/Payroll.css";

const Payroll = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [summary, setSummary] = useState(null);
  const [noData, setNoData] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // ---------------- Load Workers ----------------
  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const res = await fetch("https://attendance-tracking-system-nu.vercel.app/users");
        const data = await res.json();
        setWorkers(data);
        if (data.length > 0) {
          setSelectedWorker(data[0].worker_id);
          loadPayroll(data[0].worker_id);
        }
      } catch (err) {
        console.error("Failed to load workers:", err);
      }
    };
    loadWorkers();
  }, []);

  // ---------------- Load Payroll ----------------
  const loadPayroll = async (workerId) => {
    if (!workerId) return;

    try {
      const res = await fetch(
        `https://attendance-tracking-system-nu.vercel.app/salary-summary?worker_id=${workerId}`
      );
      const result = await res.json();
      const data = result.data;

      if (!data || data.length === 0) {
        setSummary(null);
        setNoData(true);
        if (chartInstance.current) chartInstance.current.destroy();
        return;
      }

      setNoData(false);
      setSummary(data[0]);

      // --- Chart data ---
      const attRes = await fetch(
        `https://attendance-tracking-system-nu.vercel.app/attendance/${workerId}`
      );
      const attData = await attRes.json();

      const labels = attData.map((r) =>
        new Date(r.work_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      );
      const hours = attData.map((r) =>
        Number(r.hours_worked || 0).toFixed(2)
      );

      // Destroy previous chart before creating new
      if (chartInstance.current) chartInstance.current.destroy();

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Hours Worked per Day",
              data: hours,
              backgroundColor: "rgba(102, 252, 241, 0.7)",
              borderColor: "rgba(102, 252, 241, 1)",
              borderWidth: 2,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: "#66fcf1",
                font: { size: 16 },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#c5c6c7", font: { size: 14 } },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            y: {
              ticks: { color: "#c5c6c7", font: { size: 14 }, stepSize: 1 },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
          },
          layout: { padding: { top: 20, bottom: 20, left: 10, right: 10 } },
        },
      });
    } catch (err) {
      console.error("Error loading payroll:", err);
    }
  };

  return (
    <div className="container">
      {/* LEFT SIDE */}
      <div className="left-section">
        <button className="back-btn" onClick={() => navigate("/admin")}>
          ← Back
        </button>
        <h2>Worker Payroll Analytics</h2>

        <div className="selector">
          <label htmlFor="workerSelect">Select Worker:</label>
          <select
            id="workerSelect"
            value={selectedWorker}
            onChange={(e) => {
              setSelectedWorker(e.target.value);
              loadPayroll(e.target.value);
            }}
          >
            <option value="">-- Choose Worker --</option>
            {workers.map((w) => (
              <option key={w.worker_id} value={w.worker_id}>
                {w.worker_id} - {w.job || ""}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="summary" id="summaryCards">
          {summary ? (
            <>
              <div className="card">
                <h3>Total Hours</h3>
                <p>{summary.totalHours} hrs</p>
              </div>
              <div className="card">
                <h3>Overtime</h3>
                <p>{summary.totalOvertime} hrs</p>
              </div>
              <div className="card">
                <h3>Worked Days</h3>
                <p>{summary.workedDays}</p>
              </div>
              <div className="card">
                <h3>Monthly Salary</h3>
                <p>₹{summary.totalSalary}</p>
              </div>
            </>
          ) : (
            <div className="no-data">Select a worker to view payroll</div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="right-section">
        <canvas ref={chartRef}></canvas>
        {noData && (
          <div id="noData" className="no-data">
            No data available for this worker.
          </div>
        )}
      </div>
    </div>
  );
};

export default Payroll;

