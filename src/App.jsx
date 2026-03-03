import React, { useState, useEffect } from "react";

// 🔌 BACKEND URL - Your Render backend
const BACKEND_URL = "https://poultry-backend-pwpf.onrender.com"; // final-defense


// ===== DYNAMIC STATUS HELPERS =====
function getTemperatureStatus(temp) {
  if (temp === null || temp === undefined) return { text: "No data", color: "#9ca3af" };
  if (temp >= 24 && temp <= 26) return { text: "Optimal", color: "#10b981" };
  if (temp > 26 && temp < 29) return { text: "Warning", color: "#f59e0b" };
  if (temp >= 29) return { text: "Critical", color: "#ef4444" };
  if (temp < 22) return { text: "Too Cold", color: "#3b82f6" };
  return { text: "Normal", color: "#10b981" };
}

function getHumidityStatus(humidity) {
  if (humidity === null || humidity === undefined) return { text: "No data", color: "#9ca3af" };
  if (humidity >= 60 && humidity <= 80) return { text: "Optimal", color: "#10b981" };
  if (humidity > 80 && humidity < 85) return { text: "Warning", color: "#f59e0b" };
  if (humidity >= 85) return { text: "Critical", color: "#ef4444" };
  if (humidity < 55) return { text: "Too Dry", color: "#f59e0b" };
  return { text: "Normal", color: "#10b981" };
}

function getAmmoniaStatus(ammonia) {
  if (ammonia === null || ammonia === undefined) return { text: "No data", color: "#9ca3af" };
  if (ammonia >= 0 && ammonia <= 5) return { text: "Safe", color: "#10b981" };
  if (ammonia > 5 && ammonia <= 20) return { text: "Elevated", color: "#f59e0b" };
  if (ammonia > 20) return { text: "Dangerous", color: "#ef4444" };
  return { text: "Normal", color: "#10b981" };
}

function getMethaneStatus(methane) {
  if (methane === null || methane === undefined) return { text: "No data", color: "#9ca3af" };
  if (methane >= 0 && methane <= 2) return { text: "Safe", color: "#10b981" };
  if (methane > 2 && methane <= 5) return { text: "Elevated", color: "#f59e0b" };
  if (methane > 5) return { text: "Dangerous", color: "#ef4444" };
  return { text: "Normal", color: "#10b981" };
}

function getFanStatus(rpm, duty) {
  if (rpm === null || rpm === undefined) return { text: "No data", color: "#9ca3af" };
  if (rpm === 0 && duty > 50) return { text: "Fault", color: "#ef4444" };
  if (rpm > 0) return { text: "Running", color: "#10b981" };
  return { text: "Stopped", color: "#6b7280" };
}

function getLightStatus(status) {
  if (!status) return { text: "No data", color: "#9ca3af" };
  if (status === "ON") return { text: "Active", color: "#10b981" };
  return { text: "Off", color: "#6b7280" };
}

function App() {
  // ===== STATE MANAGEMENT =====
  const [latestSensor, setLatestSensor] = useState(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState(null);
  const [lastUpdateAgeSeconds, setLastUpdateAgeSeconds] = useState(null);

  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Chart data (24-hour history)
  const [chartData, setChartData] = useState({
    temp: [],
    humidity: [],
    ammonia: [],
  });

  // Actuator states
  const [lightsState, setLightsState] = useState("OFF");
  const [lightMode, setLightMode] = useState("AUTO"); // "AUTO", "FORCE_ON", "FORCE_OFF"
  const [fanState, setFanState] = useState("OFF");    // single ventilation fan
  const [fanMode, setFanMode] = useState("AUTO");     // ✅ NEW: "AUTO", "FORCE_ON", "FORCE_OFF"
  const [washerRunning, setWasherRunning] = useState(false);
  const [washerTime, setWasherTime] = useState(45);


  // ===== FETCH LATEST SENSOR DATA =====

useEffect(() => {
  const fetchLatestSensor = async () => {
    try {
      setSensorLoading(true);
      setSensorError(null);

      const res = await fetch(`${BACKEND_URL}/api/sensors/latest`);

      if (!res.ok) {
        if (res.status === 404) {
          setLatestSensor(null);
          setLastUpdateAgeSeconds(null);
          return;
        }
        throw new Error("Failed to fetch sensor data");
      }

      const data = await res.json();
      setLatestSensor(data);

      // compute initial age based on createdAt
      if (data.createdAt) {
        const created = new Date(data.createdAt);
        const ageSec = Math.floor((Date.now() - created.getTime()) / 1000);
        setLastUpdateAgeSeconds(ageSec);
      } else {
        setLastUpdateAgeSeconds(null);
      }

      // Update actuator states from sensor data
      if (data.lightStatus) {
        // kapag AUTO lang, saka sundin ang MCU state
        if (lightMode === "AUTO") {
          setLightsState(data.lightStatus);
        }
      }

      if (data.pressureWasherStatus) {
        setWasherRunning(data.pressureWasherStatus === "ON");
      }
    } catch (err) {
      console.error("Error fetching sensor data:", err);
      setSensorError(err.message || "Error fetching sensor data");
    } finally {
      setSensorLoading(false);
    }
  };

  fetchLatestSensor();

  // mas mabilis na refresh for "live" feeling
  const intervalId = setInterval(fetchLatestSensor, 3000);
  return () => clearInterval(intervalId);
}, [lightMode]);

useEffect(() => {
  let interval;
  if (latestSensor && latestSensor.createdAt) {
    interval = setInterval(() => {
      const created = new Date(latestSensor.createdAt);
      const ageSec = Math.floor((Date.now() - created.getTime()) / 1000);
      setLastUpdateAgeSeconds(ageSec);
    }, 1000);
  }
  return () => clearInterval(interval);
}, [latestSensor]);

  // ===== FETCH HISTORICAL DATA FOR CHARTS =====
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/sensors/history?limit=24`);
        if (!res.ok) return;

        const history = await res.json();

        setChartData({
          temp: history.map((d) => d.temperature || 0),
          humidity: history.map((d) => d.humidity || 0),
          ammonia: history.map((d) => d.ammonia || 0),
        });
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchHistory();

    // Refresh chart every 5 minutes
    const intervalId = setInterval(fetchHistory, 300000);
    return () => clearInterval(intervalId);
  }, []);

  
// ===== ✅ NEW: FETCH CONTROL STATE (two-way sync) =====
useEffect(() => {
  const fetchControlState = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/control/state`);
      if (!res.ok) return;
      const control = await res.json();

      // Light
      if (control.light) {
        setLightMode(control.light.mode || "AUTO");
        if (control.light.mode === "AUTO") {
          setLightsState(control.light.state || "OFF");
        }
      }

      // Fan (use fan_positive as representative of unified fan)
      if (control.fan_positive) {
        setFanMode(control.fan_positive.mode || "AUTO");
        if (control.fan_positive.mode === "AUTO") {
          setFanState(control.fan_positive.state || "OFF");
        }
      }

      // Washer
      if (control.pressure_washer) {
        setWasherRunning(control.pressure_washer.state === "ON");
      }
    } catch (err) {
      console.error("Error fetching control state:", err);
    }
  };

  fetchControlState();
  const intervalId = setInterval(fetchControlState, 3000); // sync every 3s
  return () => clearInterval(intervalId);
}, []);

// ===== CONTROL ACTUATORS (UPDATED: with AUTO support for fan) =====
const sendControlCommand = async (target, state) => {
  try {
    // Map frontend target/state -> backend device/mode
    let device = "";
    let mode = "";
    let timerDuration = undefined;

    if (target === "light") {
      device = "light";
      if (state === "AUTO") {
        mode = "AUTO";
      } else {
        mode = state === "ON" ? "FORCE_ON" : "FORCE_OFF";
      }
    } else if (target === "fan") {
      // ✅ UPDATED: unified ventilation fan with AUTO support
      device = "fan";
      if (state === "AUTO") {
        mode = "AUTO";
      } else {
        mode = state === "ON" ? "FORCE_ON" : "FORCE_OFF";
      }
    } else if (target === "pressureWasher") {
      device = "pressure_washer";
      mode = state === "ON" ? "FORCE_ON" : "FORCE_OFF";
      // 45-second cycle tulad sa UI mo (pwede mong alisin kung gusto mong purely manual)
      if (state === "ON") {
        timerDuration = 45;
      }
    } else {
      throw new Error("Unknown target: " + target);
    }

    const body = { device, mode };
    if (timerDuration !== undefined) {
      body.timerDuration = timerDuration;
    }

    const res = await fetch(`${BACKEND_URL}/api/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Backend error:", errText);
      throw new Error("Failed to send control command");
    }

    const result = await res.json();
    console.log("Control command sent:", result);

    // Update local UI state (for instant feedback)
    if (target === "light") {
      if (state === "AUTO") {
        setLightMode("AUTO");
      } else if (state === "ON") {
        setLightMode("FORCE_ON");
        setLightsState("ON");
      } else if (state === "OFF") {
        setLightMode("FORCE_OFF");
        setLightsState("OFF");
      }
    }

    // ✅ UPDATED: fan mode handling
    if (target === "fan") {
      if (state === "AUTO") {
        setFanMode("AUTO");
      } else if (state === "ON") {
        setFanMode("FORCE_ON");
        setFanState("ON");
      } else if (state === "OFF") {
        setFanMode("FORCE_OFF");
        setFanState("OFF");
      }
    }

    if (target === "pressureWasher") {
      setWasherRunning(state === "ON");
      if (state === "ON") setWasherTime(45);
    }
  } catch (err) {
    console.error("Error sending control command:", err);
    alert("Failed to send command: " + err.message);
  }
};

  // ===== PRESSURE WASHER TIMER =====
  useEffect(() => {
    let interval;
    if (washerRunning && washerTime > 0) {
      interval = setInterval(() => {
        setWasherTime((prev) => {
          if (prev <= 1) {
            setWasherRunning(false);
            sendControlCommand("pressureWasher", "OFF");
            return 45;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [washerRunning, washerTime]);

  // ===== RESPONSIVE SIDEBAR =====
  useEffect(() => {
    const handleResize = () => {
      const isMobileNow = window.innerWidth < 768;
      setIsMobile(isMobileNow);
      if (!isMobileNow) setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isMobile &&
        !e.target.closest(".sidebar") &&
        !e.target.closest(".menu-toggle")
      ) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMobile]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const showPage = (page) => {
    setActivePage(page);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
      }}
    >
      {/* SIDEBAR */}
      <aside
        className="sidebar"
        style={{
          width: 260,
          background: "linear-gradient(135deg, #064e3b 0%, #0a4d39 100%)",
          color: "white",
          padding: "24px 16px",
          boxShadow: "2px 0 8px rgba(0,0,0,0.12)",
          position: isMobile ? "fixed" : "relative",
          left: 0,
          top: 0,
          height: "100vh",
          overflowY: "auto",
          zIndex: 100,
          transform:
            isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginRight: 12,
            }}
          >
            🐔
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
              Poultry
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Monitoring System</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SidebarButton
            icon="🏠"
            label="Dashboard"
            active={activePage === "dashboard"}
            onClick={() => showPage("dashboard")}
          />
          <SidebarButton
            icon="📋"
            label="Batch Planning"
            active={activePage === "batch"}
            onClick={() => showPage("batch")}
          />
          <SidebarButton
            icon="⚠️"
            label="Early Warnings"
            active={activePage === "alerts"}
            onClick={() => showPage("alerts")}
          />
          <SidebarButton
            icon="🙋‍♂️"
            label="Farmer Profile"
            active={activePage === "profile"}
            onClick={() => showPage("profile")}
          />
          <SidebarButton
            icon="⚙️"
            label="Settings"
            active={activePage === "settings"}
            onClick={() => showPage("settings")}
          />
        </nav>
      </aside>

      {/* OVERLAY for mobile */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 99,
          }}
        />
      )}

      {/* MAIN CONTENT */}
      <main style={{ flex: 1 }}>
        {/* HEADER */}
        <header
          style={{
            background: "white",
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button
                className="menu-toggle"
                onClick={toggleSidebar}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#111827",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                }}
                title={sidebarOpen ? "Close menu" : "Open menu"}
              >
                {sidebarOpen ? "✖" : "☰"}
              </button>
            )}
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Poultry Monitoring & Control System - Final Defense
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Environmental monitoring, early warning detection, and automated control
              </p>
            </div>
          </div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              backgroundColor: sensorError ? "#fee2e2" : "#dcfce7",
              fontSize: 12,
              fontWeight: 600,
              color: sensorError ? "#991b1b" : "#166534",
              whiteSpace: "nowrap",
            }}
          >
            {sensorError ? "✖ System: Error" : sensorLoading ? "⏳ Loading..." : "✔ System: Normal"}
          </div>
        </header>

        {/* FARM INFO */}
        <div
          style={{
            background: "white",
            margin: "16px 24px 0",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <strong>Owner:</strong> Kuya Emil | El Pueblo, Caypombo, Sta. Maria, Bulacan | 2 years broiler poultry house
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Phase: Growing</div>
        </div>

        {/* CONTENT AREA */}
        <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
          {activePage === "dashboard" && (
            <DashboardPage
  chartData={chartData}
  washerRunning={washerRunning}
  washerTime={washerTime}
  latestSensor={latestSensor}
  sensorLoading={sensorLoading}
  sensorError={sensorError}
  lightsState={lightsState}
  lightMode={lightMode}
  fanState={fanState}
  fanMode={fanMode}
  sendControlCommand={sendControlCommand}
  lastUpdateAgeSeconds={lastUpdateAgeSeconds}
/>

          )}
          {activePage === "batch" && <BatchPlanningPage />}
          {activePage === "alerts" && <AlertsPage />}
          {activePage === "profile" && <ProfilePage />}
          {activePage === "settings" && <SettingsPage />}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            width: 100% !important;
            height: auto !important;
            max-height: 100vh !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ===== DASHBOARD PAGE ===== */
function DashboardPage({
  chartData,
  washerRunning,
  washerTime,
  latestSensor,
  sensorLoading,
  sensorError,
  lightsState,
  lightMode,
  fanState,
  fanMode,
  sendControlCommand,
  lastUpdateAgeSeconds,

}) {

  const isStale =
  lastUpdateAgeSeconds !== null && lastUpdateAgeSeconds > 60; // 60s example

  return (
    <>
      {sensorError && (
        <div style={{ 
          background: "#fee2e2", 
          border: "1px solid #fca5a5",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 13,
          color: "#991b1b"
        }}>
          ⚠️ Sensor error: {sensorError}
        </div>
      )}

      {/* LIVE ENVIRONMENT PARAMETERS */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          🌡️ Live Environment Parameters
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
      <ParamCard
  icon="🌡️"
  title="Temperature"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.temperature === "number"
      ? `${latestSensor.temperature.toFixed(1)}°C`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getTemperatureStatus(latestSensor?.temperature).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getTemperatureStatus(latestSensor?.temperature).color
  }
  bgColor="#e0f2fe"
  note="Target: 24–26°C"
/>

<ParamCard
  icon="💧"
  title="Humidity"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.humidity === "number"
      ? `${latestSensor.humidity.toFixed(0)}%`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getHumidityStatus(latestSensor?.humidity).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getHumidityStatus(latestSensor?.humidity).color
  }
  bgColor="#dcfce7"
  note="Target: 60–80%"
/>

         
      <ParamCard
  icon="☣️"
  title="Ammonia (NH₃)"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.ammonia === "number"
      ? `${latestSensor.ammonia.toFixed(1)} ppm`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getAmmoniaStatus(latestSensor?.ammonia).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getAmmoniaStatus(latestSensor?.ammonia).color
  }
  bgColor="#fef3c7"
  note="Optimal: 0–5 ppm"
/>
    <ParamCard
  icon="💨"
  title="Methane (CH₄)"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.methane === "number"
      ? `${latestSensor.methane.toFixed(1)} ppm`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getMethaneStatus(latestSensor?.methane).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getMethaneStatus(latestSensor?.methane).color
  }
  bgColor="#fecaca"
  note="Optimal: 0–2 ppm"
/>

<ParamCard
  icon="🌀"
  title="Positive Pressure Fan"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.fanIntakeRpm === "number"
      ? `${latestSensor.fanIntakeRpm.toFixed(0)} rpm`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getFanStatus(
          latestSensor?.fanIntakeRpm,
          latestSensor?.fanIntakeDuty
        ).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getFanStatus(
          latestSensor?.fanIntakeRpm,
          latestSensor?.fanIntakeDuty
        ).color
  }
  bgColor="#cffafe"
  note="Intake fan"
/>
<ParamCard
  icon="🌀"
  title="Exhaust Fan"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.fanExhaustRpm === "number"
      ? `${latestSensor.fanExhaustRpm.toFixed(0)} rpm`
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getFanStatus(
          latestSensor?.fanExhaustRpm,
          latestSensor?.fanExhaustDuty
        ).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getFanStatus(
          latestSensor?.fanExhaustRpm,
          latestSensor?.fanExhaustDuty
        ).color
  }
  bgColor="#cffafe"
  note="Exhaust fan"
/>
<ParamCard
  icon="💡"
  title="Lighting"
  value={
    !latestSensor || isStale
      ? "—"
      : typeof latestSensor.lightStatus === "string"
      ? latestSensor.lightStatus
      : sensorLoading
      ? "Loading..."
      : "—"
  }
  status={
    !latestSensor || isStale
      ? "No recent data"
      : getLightStatus(latestSensor?.lightStatus).text
  }
  statusColor={
    !latestSensor || isStale
      ? "#9ca3af"
      : getLightStatus(latestSensor?.lightStatus).color
  }
  bgColor="#fef08a"
  note="20–40 lux"
/>


        </div>
      </section>

      {/* CONTROLS SECTION */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          🎮 Manual Controls (Testing)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {/* LIGHTS */}
<ControlPanel title="💡 Lighting Control">
  <div style={{ marginBottom: 20 }}>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 8,
        display: "block",
      }}
    >
      Growing Phase Lights
    </span>
    <div style={{ display: "flex", gap: 8 }}>
      <ToggleButton
        active={lightMode === "AUTO"}
        onClick={() => sendControlCommand("light", "AUTO")}
      >
        AUTO
      </ToggleButton>
      <ToggleButton
        active={lightMode === "FORCE_ON"}
        onClick={() => sendControlCommand("light", "ON")}
      >
        FORCE ON
      </ToggleButton>
      <ToggleButton
        active={lightMode === "FORCE_OFF"}
        onClick={() => sendControlCommand("light", "OFF")}
      >
        FORCE OFF
      </ToggleButton>
    </div>
    <div
      style={{
        marginTop: 6,
        fontSize: 11,
        color: "#6b7280",
      }}
    >
      Current state: {lightsState} ({lightMode})
    </div>
  </div>
</ControlPanel>

         {/* ✅ UPDATED: FANS with AUTO mode */}
<ControlPanel title="📊 Ventilation Fan Control">
  <div style={{ marginBottom: 20 }}>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 8,
        display: "block",
      }}
    >
      Ventilation Fan (Unified)
    </span>
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      <ToggleButton
        active={fanMode === "AUTO"}
        onClick={() => sendControlCommand("fan", "AUTO")}
      >
        AUTO
      </ToggleButton>
      <ToggleButton
        active={fanMode === "FORCE_ON"}
        onClick={() => sendControlCommand("fan", "ON")}
      >
        FORCE ON
      </ToggleButton>
      <ToggleButton
        active={fanMode === "FORCE_OFF"}
        onClick={() => sendControlCommand("fan", "OFF")}
      >
        FORCE OFF
      </ToggleButton>
    </div>
    <div
      style={{
        fontSize: 11,
        color: "#6b7280",
      }}
    >
      Current state: {fanState} ({fanMode})
    </div>
  </div>
</ControlPanel>

          {/* PRESSURE WASHER */}
          <ControlPanel title="🚿 Pressure Washer">
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: 8,
                  display: "block",
                }}
              >
                45 Second Cycle
              </span>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <ToggleButton
                  active={washerRunning}
                  onClick={() => sendControlCommand("pressureWasher", "ON")}
                >
                  START
                </ToggleButton>
                <ToggleButton
                  active={!washerRunning}
                  onClick={() => sendControlCommand("pressureWasher", "OFF")}
                >
                  STOP
                </ToggleButton>
              </div>
              {washerRunning && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#ef4444",
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  Running: <span>{washerTime}</span>s
                </div>
              )}
            </div>
          </ControlPanel>
        </div>
      </section>

      {/* SETPOINTS */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          ⚙️ Current Setpoints
        </h2>
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <SetpointItem label="Temperature Setpoint (PID):" value="25–26°C" />
          <SetpointItem label="Humidity Target:" value="60–80%" />
          <SetpointItem label="Light ON / OFF:" value="20 lux / 40 lux" />
          <SetpointItem label="Ammonia Warning:" value=">20 ppm" />
          <SetpointItem label="Methane Optimal:" value="0–2 ppm" last={true} />
        </div>
      </section>

      {/* CHARTS */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          📊 Environmental Trends (24-Hour)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          <ChartContainer
            title="🌡️ Temperature Trend"
            data={chartData.temp}
            maxValue={35}
            color="#3b82f6"
          />
          <ChartContainer
            title="💧 Humidity Trend"
            data={chartData.humidity}
            maxValue={100}
            color="#0ea5e9"
          />
          <ChartContainer
            title="☣️ Ammonia Level Trend"
            data={chartData.ammonia}
            maxValue={25}
            color="#f97316"
          />
        </div>
      </section>
    </>
  );
}

// ===== REUSABLE COMPONENTS =====

function SidebarButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "11px 12px",
        border: "none",
        borderRadius: 8,
        background: active ? "#10b981" : "transparent",
        color: "white",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "all 0.2s ease",
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function ParamCard({ icon, title, value, status, statusColor, bgColor, note }) {
  return (
    <div style={{ background: bgColor, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 14, transition: "all 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <h3 style={{ fontSize: 12, margin: 0, color: "#6b7280", fontWeight: 500 }}>{title}</h3>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827", marginBottom: 6 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 4, display: "inline-block", background: statusColor || "#dcfce7", color: "white", margin: "4px 0 0" }}>{status}</p>
      <p style={{ fontSize: 10, margin: "4px 0 0", color: "#9ca3af" }}>{note}</p>
    </div>
  );
}

function ControlPanel({ title, children }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ControlRow({ label, state, onOn, onOff }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 8,
          display: "block",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <ToggleButton active={state === "ON"} onClick={onOn}>
          ON
        </ToggleButton>
        <ToggleButton active={state === "OFF"} onClick={onOff}>
          OFF
        </ToggleButton>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        border: active ? "2px solid #10b981" : "2px solid #e5e7eb",
        borderRadius: 6,
        background: active ? "#10b981" : "white",
        color: active ? "white" : "#111827",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

function SetpointItem({ label, value, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid #e5e7eb",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 600, color: "#111827" }}>{label}</span>
      <span style={{ color: "#10b981", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ChartContainer({ title, data, maxValue, color }) {
  const hasData = data && data.length > 0;
  
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
        {title}
      </h3>
      <div style={{ height: 150, position: "relative", display: "flex", alignItems: "flex-end", gap: 4 }}>
        {hasData ? (
          data.map((val, i) => {
            const height = Math.max((val / maxValue) * 100, 2);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${height}%`,
                  backgroundColor: color,
                  borderRadius: "2px 2px 0 0",
                  minHeight: 2,
                }}
                title={`${val.toFixed(1)}`}
              />
            );
          })
        ) : (
          <div style={{ width: "100%", textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "60px 0" }}>
            No data yet - waiting for ESP32...
          </div>
        )}
      </div>
    </div>
  );
}

// ===== OTHER PAGES (Batch Planning, Alerts, Profile, Settings) =====

function BatchPlanningPage() {
  const [batchStart, setBatchStart] = useState("2025-12-27");
  const [harvestDate, setHarvestDate] = useState("2026-02-14");
  const [batchPhase, setBatchPhase] = useState("Growing");
  const [totalBirds, setTotalBirds] = useState(2448);
  const [birdsDied, setBirdsDied] = useState(0);
  const avgWeight = 2.1;
  const daysToMarket = 18;

  const mortalityRate = totalBirds > 0 ? ((birdsDied / totalBirds) * 100).toFixed(1) : "0.0";
  const healthyBirds = Math.max(totalBirds - birdsDied, 0);
  const survivalRate = totalBirds > 0 ? (((totalBirds - birdsDied) / totalBirds) * 100).toFixed(1) : "0.0";

  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
          📊 Farm Statistics Dashboard
        </h2>

        <div
          style={{
            background: "white",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
            📋 Update Flock Information
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6, display: "block" }}>
                Total Birds in Coop
              </label>
              <input
                type="number"
                min={0}
                value={totalBirds}
                onChange={(e) => setTotalBirds(isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6, display: "block" }}>
                Birds Died (Last 7 Days)
              </label>
              <input
                type="number"
                min={0}
                value={birdsDied}
                onChange={(e) => setBirdsDied(isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            ✔ Changes saved automatically
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard label="Total Birds" value={totalBirds.toLocaleString()} unit="in coop" />
          <StatCard label="Mortality Rate" value={`${mortalityRate}%`} unit="last 7 days" />
          <StatCard label="Avg Weight" value={avgWeight} unit="kg per bird" />
          <StatCard label="Days to Market" value={daysToMarket} unit="days remaining" />
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
            📊 Flock Summary
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <div
              style={{
                borderRadius: 10,
                border: "2px solid #22c55e",
                padding: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>✔</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>
                Healthy Birds
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 2 }}>
                {healthyBirds.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{survivalRate}% survival</div>
            </div>

            <div
              style={{
                borderRadius: 10,
                border: "2px solid #ef4444",
                padding: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>✖</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 4 }}>
                Birds Lost
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#b91c1c", marginBottom: 2 }}>
                {birdsDied.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{mortalityRate}% mortality</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
          🗓️ Batch Timeline
        </h2>
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <TimelineItem
              label="Batch Start Date"
              value={batchStart}
              icon="🐣"
            />
            <TimelineItem
              label="Current Phase"
              value={batchPhase}
              icon="📈"
            />
            <TimelineItem
              label="Expected Harvest"
              value={harvestDate}
              icon="🎯"
            />
            <TimelineItem
              label="Days Remaining"
              value={`${daysToMarket} days`}
              icon="⏰"
              last
            />
          </div>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>{unit}</div>
    </div>
  );
}

function TimelineItem({ label, value, icon, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{value}</span>
    </div>
  );
}

function AlertsPage() {
  const alerts = [
    {
      id: 1,
      type: "warning",
      message: "Ammonia levels approaching threshold (4.8 ppm)",
      time: "5 minutes ago",
    },
    {
      id: 2,
      type: "info",
      message: "Temperature stabilized at optimal range",
      time: "22 minutes ago",
    },
    {
      id: 3,
      type: "success",
      message: "All environmental parameters normal",
      time: "1 hour ago",
    },
  ];

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
        ⚠️ Early Warning Alerts
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  );
}

function AlertCard({ alert }) {
  const colors = {
    warning: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    info: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
    success: { bg: "#dcfce7", border: "#10b981", text: "#065f46" },
  };

  const style = colors[alert.type];

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: style.text }}>
        {alert.message}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>{alert.time}</p>
    </div>
  );
}

function ProfilePage() {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
        👤 Farmer Profile
      </h2>
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <ProfileItem label="Owner Name" value="Kuya Emil" />
        <ProfileItem label="Farm Location" value="El Pueblo, Caypombo, Sta. Maria, Bulacan" />
        <ProfileItem label="Farm Type" value="Broiler Poultry" />
        <ProfileItem label="Years of Operation" value="2 years" />
        <ProfileItem label="Contact" value="+63 912 345 6789" last />
      </div>
    </section>
  );
}

function ProfileItem({ label, value, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid #e5e7eb",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 600, color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#111827" }}>{value}</span>
    </div>
  );
}

function SettingsPage() {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
        ⚙️ System Settings
      </h2>
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Settings configuration coming soon...
        </p>
      </div>
    </section>
  );
}

export default App;