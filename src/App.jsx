import React, { useState, useEffect } from "react";

// BACKEND URL - Your Render backend
const BACKEND_URL = "https://poultry-backend-pwpf.onrender.com";

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
  const [fanState, setFanState] = useState("OFF"); // single ventilation fan
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

  // ===== CONTROL ACTUATORS (NEW, TWO-WAY) =====
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
        // unified ventilation fan
        device = "fan";
        mode = state === "ON" ? "FORCE_ON" : "FORCE_OFF";
      } else if (target === "pressureWasher") {
        device = "pressure_washer";
        mode = state === "ON" ? "FORCE_ON" : "FORCE_OFF";
        // 45-second cycle tulad sa UI mo
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

      if (target === "fan") {
        setFanState(state);
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
      if (!isMobileNow) {
        setSidebarOpen(true);
      }
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

  const isStale =
    lastUpdateAgeSeconds !== null && lastUpdateAgeSeconds > 60; // 60s example

  // ===== MAIN RENDER =====
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: '"Segoe UI", Arial, sans-serif',
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
          height: isMobile ? "100vh" : "auto",
          overflowY: "auto",
          zIndex: 100,
          transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 50,
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
            icon="📊"
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
            icon="🚨"
            label="Early Warnings"
            active={activePage === "alerts"}
            onClick={() => showPage("alerts")}
          />
          <SidebarButton
            icon="👨‍🌾"
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

      {/* OVERLAY (mobile) */}
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
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              >
                {sidebarOpen ? "✕" : "☰"}
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
                Poultry Monitoring & Control System
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

          <div>
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
              {sensorError
                ? "System Error"
                : sensorLoading
                ? "Loading..."
                : "System Normal"}
            </div>
          </div>
        </header>

        {/* FARM INFO BAR */}
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
            <strong>Owner:</strong> Kuya Emil | El Pueblo, Caypombo, Sta. Maria, Bulacan
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              2 years broiler poultry house
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Phase: Growing</div>
          </div>
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
    </div>
  );
}

// ===== DASHBOARD PAGE =====
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
  sendControlCommand,
  lastUpdateAgeSeconds,
}) {
  const isStale =
    lastUpdateAgeSeconds !== null && lastUpdateAgeSeconds > 60; // 60s example

  if (sensorError) {
    return (
      <div
        style={{
          background: "#fee2e2",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 13,
          color: "#991b1b",
        }}
      >
        Sensor error: {sensorError}
      </div>
    );
  }

  return (
    <>
      {/* LIVE PARAMETERS */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          Live Environment Parameters
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
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.temperature === "number"
                ? `${latestSensor.temperature.toFixed(1)} °C`
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
            note="Target: 24–26 °C"
          />
          <ParamCard
            icon="💧"
            title="Humidity"
            value={
              !latestSensor || isStale
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.humidity === "number"
                ? `${latestSensor.humidity.toFixed(0)} %`
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
            note="Target: 60–80 %"
          />
          <ParamCard
            icon="🧪"
            title="Ammonia (NH₃)"
            value={
              !latestSensor || isStale
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.ammonia === "number"
                ? `${latestSensor.ammonia.toFixed(1)} ppm`
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
            icon="🔥"
            title="Methane (CH₄)"
            value={
              !latestSensor || isStale
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.methane === "number"
                ? `${latestSensor.methane.toFixed(1)} ppm`
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
            icon="💨"
            title="Ventilation Fan"
            value={
              !latestSensor || isStale
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.fanRpm === "number"
                ? `${latestSensor.fanRpm.toFixed(0)} rpm`
                : "—"
            }
            status={
              !latestSensor || isStale
                ? "No recent data"
                : getFanStatus(
                    latestSensor?.fanRpm,
                    latestSensor?.fanDuty
                  ).text
            }
            statusColor={
              !latestSensor || isStale
                ? "#9ca3af"
                : getFanStatus(
                    latestSensor?.fanRpm,
                    latestSensor?.fanDuty
                  ).color
            }
            bgColor="#cffafe"
            note="Unified ventilation fan"
          />
          <ParamCard
            icon="💡"
            title="Lighting"
            value={
              !latestSensor || isStale
                ? sensorLoading
                  ? "Loading..."
                  : "—"
                : typeof latestSensor.lightStatus === "string"
                ? latestSensor.lightStatus
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

      {/* CONTROLS */}
      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          Manual Controls (Testing)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {/* LIGHTS */}
          <ControlPanel title="Lighting Control">
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
                Current state: {lightsState}
              </div>
            </div>
          </ControlPanel>

          {/* FAN */}
          <ControlPanel title="Ventilation Fan Control">
            <ControlRow
              label="Ventilation Fan"
              state={fanState}
              onOn={() => sendControlCommand("fan", "ON")}
              onOff={() => sendControlCommand("fan", "OFF")}
            />
          </ControlPanel>

          {/* PRESSURE WASHER */}
          <ControlPanel title="Pressure Washer">
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
                Running {washerTime}s
              </div>
            )}
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
          Current Setpoints
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
          <SetpointItem label="Temperature Setpoint (PID)" value="25–26 °C (grown birds)" />
          <SetpointItem label="Humidity Target" value="60–80 %" />
          <SetpointItem label="Ammonia Warning" value="> 20 ppm" />
          <SetpointItem label="Methane Optimal" value="0–2 ppm" />
          <SetpointItem label="Lighting ON / OFF" value="20 lux / 40 lux" last />
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
          Environmental Trends (24-Hour)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          <ChartContainer title="Temperature Trend" data={chartData.temp} maxValue={35} color="#3b82f6" />
          <ChartContainer title="Humidity Trend" data={chartData.humidity} maxValue={100} color="#0ea5e9" />
          <ChartContainer title="Ammonia Level Trend" data={chartData.ammonia} maxValue={25} color="#f97316" />
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
        opacity: active ? 1 : 0.9,
        transform: active ? "translateX(2px)" : "translateX(0)",
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
    <div
      style={{
        background: bgColor,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 10,
        padding: 14,
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <h3
          style={{
            fontSize: 12,
            margin: 0,
            color: "#6b7280",
            fontWeight: 500,
          }}
        >
          {title}
        </h3>
      </div>
      <p
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 8px",
          borderRadius: 4,
          display: "inline-block",
          background: statusColor || "#dcfce7",
          color: "white",
          margin: "4px 0 0",
        }}
      >
        {status}
      </p>
      <p
        style={{
          fontSize: 10,
          margin: "4px 0 0",
          color: "#9ca3af",
        }}
      >
        {note}
      </p>
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
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
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
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          height: 150,
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
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
                  title: val.toFixed(1),
                }}
              />
            );
          })
        ) : (
          <div
            style={{
              width: "100%",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 12,
              padding: "60px 0",
            }}
          >
            No data yet – waiting for ESP32...
          </div>
        )}
      </div>
    </div>
  );
}

// ===== OTHER PAGES =====
function BatchPlanningPage() {
  const [batchStart, setBatchStart] = useState("2025-12-27");
  const [harvestDate, setHarvestDate] = useState("2026-02-14");
  const [batchPhase, setBatchPhase] = useState("Growing");
  const [totalBirds, setTotalBirds] = useState(2448);
  const [birdsDied, setBirdsDied] = useState(0);

  const avgWeight = 2.1;
  const daysToMarket = 18;

  const mortalityRate =
    totalBirds > 0 ? ((birdsDied / totalBirds) * 100).toFixed(1) : "0.0";
  const healthyBirds = Math.max(totalBirds - birdsDied, 0);
  const survivalRate =
    totalBirds > 0
      ? (((totalBirds - birdsDied) / totalBirds) * 100).toFixed(1)
      : "0.0";

  return (
    <section style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        Farm Statistics Dashboard
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
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          Update Flock Information
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
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 6,
                display: "block",
              }}
            >
              Total Birds in Coop
            </label>
            <input
              type="number"
              min={0}
              value={totalBirds}
              onChange={(e) =>
                setTotalBirds(
                  isNaN(parseInt(e.target.value, 10))
                    ? 0
                    : parseInt(e.target.value, 10)
                )
              }
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
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 6,
                display: "block",
              }}
            >
              Birds Died (Last 7 Days)
            </label>
            <input
              type="number"
              min={0}
              value={birdsDied}
              onChange={(e) =>
                setBirdsDied(
                  isNaN(parseInt(e.target.value, 10))
                    ? 0
                    : parseInt(e.target.value, 10)
                )
              }
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
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 4,
          }}
        >
          Changes saved automatically
        </div>
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
        <StatCard label="Mortality Rate" value={mortalityRate} unit="% last 7 days" />
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
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          Flock Summary
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
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#16a34a",
                marginBottom: 4,
              }}
            >
              Healthy Birds
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#166534",
                marginBottom: 2,
              }}
            >
              {healthyBirds.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {survivalRate}% survival
            </div>
          </div>
          <div
            style={{
              borderRadius: 10,
              border: "2px solid #ef4444",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>❌</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#b91c1c",
                marginBottom: 4,
              }}
            >
              Birds Lost
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#b91c1c",
                marginBottom: 2,
              }}
            >
              {birdsDied.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>last 7 days</div>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          Expected Harvest & Batch Planning
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <FormGroup
              label="Batch Start Date"
              value={batchStart}
              onChange={setBatchStart}
              type="date"
            />
            <FormGroup
              label="Expected Harvest Date"
              value={harvestDate}
              onChange={setHarvestDate}
              type="date"
            />
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Batch Phase
              </label>
              <select
                value={batchPhase}
                onChange={(e) => setBatchPhase(e.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "inherit",
                  background: "#f9fafb",
                  width: "100%",
                }}
              >
                <option>Brooding (0–14 days)</option>
                <option>Growing (15–28 days)</option>
                <option>Finishing (29+ days)</option>
              </select>
            </div>
          </div>
        </div>
      </section>
    </section>
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
        boxShadow: "0 1px 3px rgba(16, 185, 129, 0.1)",
      }}
    >
      <div
        style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#10b981",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

function FormGroup({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "inherit",
          background: "#f9fafb",
          width: "100%",
        }}
      />
    </div>
  );
}

function AlertsPage() {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        Early Warning Notifications
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
        <AlertItem
          title="Current System State"
          message="Healthy – All parameters within normal range"
          type="success"
        />
        <AlertItem
          title="Waiting for ESP32 data"
          message="Connect your ESP32 to start receiving real-time alerts and warnings."
          type="info"
        />
      </div>
    </section>
  );
}

function AlertItem({ title, message, type }) {
  const typeStyles = {
    success: { bg: "#dcfce7", borderLeft: "#16a34a", textColor: "#166534" },
    warning: { bg: "#fef3c7", borderLeft: "#f59e0b", textColor: "#92400e" },
    info: { bg: "#dbeafe", borderLeft: "#3b82f6", textColor: "#1e40af" },
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      style={{
        background: style.bg,
        borderLeft: `4px solid ${style.borderLeft}`,
        padding: 16,
        marginBottom: 12,
        borderRadius: 8,
      }}
    >
      <h4
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          color: style.textColor,
          marginBottom: 4,
        }}
      >
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: 12, color: style.textColor }}>{message}</p>
    </div>
  );
}

function ProfilePage() {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        Farmer Profile
      </h2>
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 20,
          maxWidth: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <ProfileItem label="Name" value="Kuya Emil" />
        <ProfileItem
          label="Location"
          value="El Pueblo, Caypombo, Sta. Maria, Bulacan"
        />
        <ProfileItem
          label="Experience"
          value="2 years broiler poultry house owner"
        />
        <ProfileItem
          label="About"
          value="Kuya Emil’s farm is the primary deployment site for this Poultry Monitoring and Control System. His operational experience and feedback are integral to system validation and real-world performance evaluation for broiler production in tropical environments."
          last
        />
      </div>
    </section>
  );
}

function ProfileItem({ label, value, last = false }) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: "#111827" }}>{value}</div>
    </div>
  );
}

function SettingsPage() {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        System Settings & Thresholds
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <SettingsCard
          title="Temperature Control (PID-based)"
          items={[
            { label: "Setpoint", value: "25–26 °C (grown birds)" },
            { label: "Optimal", value: "24–26 °C" },
            { label: "Warning", value: "27–29 °C" },
            { label: "Critical", value: "≥ 29 °C or ≤ 22 °C" },
            { label: "Kp", value: "0.8–2.0" },
            { label: "Ki", value: "0.2–0.5" },
            { label: "Kd", value: "0.1–0.3" },
          ]}
        />
        <SettingsCard
          title="Humidity Monitoring"
          items={[
            { label: "Optimal", value: "60–80 %" },
            { label: "Warning", value: "81–85 %" },
            { label: "Critical", value: "≥ 85 % or ≤ 55 %" },
          ]}
        />
        <SettingsCard
          title="Ammonia Gas Control"
          items={[
            { label: "Optimal", value: "0–5 ppm (fan 20–30%)" },
            { label: "Normal", value: "6–20 ppm (fan 40–80%)" },
            { label: "Critical", value: "> 20 ppm (fan 100%)" },
          ]}
        />
        <SettingsCard
          title="Lighting Control"
          items={[
            { label: "Growing", value: "ON 20 lux, OFF 40 lux" },
            { label: "Brooding", value: "ON 80 lux, OFF 100 lux" },
          ]}
        />
        <SettingsCard
          title="Fan Monitoring (RPM)"
          items={[
            { label: "Normal", value: "RPM matches PWM relationship" },
            { label: "Warning", value: "RPM < 1500 (bearing wear)" },
            { label: "Critical", value: "RPM 0 at PWM 50%" },
          ]}
        />
        <SettingsCard
          title="Methane Thresholds"
          items={[
            { label: "Optimal", value: "0–2 ppm (litter dry)" },
            { label: "Elevated", value: "3–5 ppm (fan 40–60%)" },
            { label: "Critical", value: "> 5 ppm (fan 90–100%)" },
          ]}
        />
      </div>
    </section>
  );
}

function SettingsCard({ title, items }) {
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
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 16,
          color: "#111827",
        }}
      >
        {title}
      </h3>
      {items.map(({ label, value }, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom:
              i === items.length - 1 ? "none" : "1px solid #f3f4f6",
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: "#6b7280" }}>{label}</span>
          <span style={{ color: "#111827" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export default App;
