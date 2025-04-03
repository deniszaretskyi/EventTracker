import { useEffect, useState } from "react";
import RecorderButton from "./components/RecorderButton";
import SessionSelector from "./components/SessionSelector";
import Player from "./components/Player/Player";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // Fetch the list of sessions on mount
  useEffect(() => {
    fetch("http://localhost:3001/api/sessions")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch sessions list: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("[App] Sessions loaded:", data);
        if (Array.isArray(data)) setSessions(data);
      })
      .catch((err) => console.error("Error fetching sessions list:", err));
  }, []);

  const handleSessionSelect = async (sessionId) => {
    console.log("[App] Selected session:", sessionId);
    if (!sessionId) return;

    try {
      const res = await fetch(
        `http://localhost:3001/api/sessions/${sessionId}`
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch session ${sessionId}: ${res.status}`);
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.events) || !data.domSnapshot) {
        console.error("Invalid session data:", data);
        return;
      }
      setCurrentSession(data);
      console.log(
        `[App] Loaded session ${sessionId} with ${data.events.length} events`
      );
    } catch (error) {
      console.error("Error fetching session data:", error);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>My Recording & Playback App</h1>
      {/* 1) Recorder control */}
      <div style={{ marginBottom: "1rem" }}>
        <RecorderButton />
      </div>

      {/* 2) List or dropdown to select existing sessions */}
      <SessionSelector sessions={sessions} onSelect={handleSessionSelect} />

      {/* 3) The player for the chosen session */}
      {currentSession ? (
        <div style={{ marginTop: "1rem" }}>
          <Player
            events={currentSession.events}
            domSnapshot={currentSession.domSnapshot}
          />
        </div>
      ) : (
        <p>Select a session above or record a new one.</p>
      )}
    </div>
  );
}
