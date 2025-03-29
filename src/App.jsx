import { useState, useEffect } from "react";
import { Player } from "./components/Player/Player";
import { Recorder } from "./recorder/useRecorder";

const DEMO_SESSION_ID = "demo";

export default function App() {
  const [demoState, setDemoState] = useState({
    isLoaded: false,
    error: null,
    data: null,
  });

  const loadSession = async (sessionId) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/sessions/${sessionId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error: ${errorText}`);
      }

      const data = await response.json();

      // data structure validation
      if (!data?.dom || !data?.events) {
        throw new Error("Invalid session data structure from server");
      }

      return data;
    } catch (error) {
      console.error("Session load failed:", error);
      throw error;
    }
  };

  useEffect(() => {
    const loadDemo = async () => {
      try {
        const data = await loadSession(DEMO_SESSION_ID);

        setDemoState({
          isLoaded: true,
          error: null,
          data,
        });
      } catch (error) {
        setDemoState({
          isLoaded: false,
          error: error.message,
          data: null,
        });
      }
    };

    loadDemo();
  }, []);

  return (
    <div className="homepage">
      <h1>Player</h1>

      {demoState.error && (
        <div className="error-message">
          <p>Error: {demoState.error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      )}

      <div className="demo-container" style={{ marginTop: "2rem" }}>
        {demoState.isLoaded ? (
          <Player
            sessionId={DEMO_SESSION_ID}
            autoPlay={true}
            initialData={demoState.data}
          />
        ) : !demoState.error ? (
          <div
            className="loader"
            style={{
              padding: "1rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            Loading DEMO...
          </div>
        ) : null}
      </div>
      <button
        onClick={() => {
          const recorder = new Recorder();
          recorder.start();
          console.log("Recorder started:", recorder.sessionId);
        }}
      >
        Start Recording
      </button>
    </div>
  );
}
