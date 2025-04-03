// Project/src/components/Player/Player.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  rebuildDOM,
  applyBatchedMutations,
} from "../../utils/domReconstructor";

/**
 * Player component is responsible for taking:
 * - an array of recorded events
 * - a DOM snapshot
 * and replaying them in an iframe.
 *
 * Key changes:
 * - We rely on `metadata.duration` to determine the total session length (in ms).
 * - We apply events by their timestamps, but the playback loop continues
 *   until the "duration" time is reached, even if the last event is earlier.
 */
export default function Player({ events, domSnapshot }) {
  const [status, setStatus] = useState("idle"); // "idle" | "loading" | "ready" | "error"
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds

  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const rafId = useRef(null);
  const startTimestamp = useRef(null); // used in playback loop
  const isPlayingRef = useRef(false); // track playback state
  const eventsQueueRef = useRef([]); // copy of events to apply

  // 1) Create/attach iframe on mount
  useEffect(() => {
    setStatus("loading");

    // If there's an existing iframe, remove it
    if (iframeRef.current) {
      containerRef.current.removeChild(iframeRef.current);
      iframeRef.current = null;
    }

    // Create a new iframe
    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.style.cssText = "width:100%; height:600px; border:none;";
    iframe.onload = () => handleIframeLoad();
    iframe.onerror = () => handleError("Iframe failed to load");
    containerRef.current.appendChild(iframe);
    iframeRef.current = iframe;

    // Cleanup on unmount
    return () => {
      if (iframeRef.current && containerRef.current) {
        containerRef.current.removeChild(iframeRef.current);
        iframeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // 2) Called once iframe finishes loading
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              html, body {
                margin: 0; 
                padding: 0; 
                overflow: hidden;
              }
              .replayer-mouse {
                position: absolute;
                width: 15px;
                height: 15px;
                background: #f00;
                border-radius: 50%;
                pointer-events: none;
                transition: transform 0.05s linear;
                z-index: 9999;
              }
            </style>
          </head>
          <body></body>
        </html>
      `);
      doc.close();

      // Give the iframe a little time to finalize DOM
      setTimeout(() => {
        if (!doc.body) {
          handleError("Iframe doc.body not found");
          return;
        }

        // Rebuild the recorded DOM from the snapshot
        if (domSnapshot) {
          rebuildDOM(domSnapshot, doc);
          setStatus("ready");
          setError(null);

          // Prepare events & set total duration
          if (events && events.length > 0) {
            // Sort events by timestamp (should already be in order, but just to be sure)
            events.sort((a, b) => a.timestamp - b.timestamp);
            eventsQueueRef.current = [...events];

            // (A) If we have metadata.duration, use it
            // (B) Otherwise, fallback to lastEvent.timestamp - firstEvent.timestamp
            const totalMsFromMetadata = domSnapshot?.metadata?.duration;
            if (
              typeof totalMsFromMetadata === "number" &&
              totalMsFromMetadata > 0
            ) {
              setDuration(totalMsFromMetadata / 1000);
            } else {
              const firstT = events[0].timestamp;
              const lastT = events[events.length - 1].timestamp;
              setDuration((lastT - firstT) / 1000);
            }
          }
        } else {
          handleError("No domSnapshot found in props");
        }
      }, 100);
    } catch (err) {
      handleError("Iframe write error: " + err.message);
    }
  };

  const handleError = (msg) => {
    console.error("[Player] error:", msg);
    setStatus("error");
    setError(msg);
  };

  /**
   * The main playback loop, scheduled via requestAnimationFrame.
   * It calculates how much time has elapsed since we pressed "Play"
   * and updates currentTime (in seconds). Also, applies any events
   * whose timestamps fall into that time.
   */
  const playbackLoop = useCallback(
    (timestamp) => {
      if (!isPlayingRef.current) return;

      // init start time
      if (!startTimestamp.current) {
        // "timestamp" is the time of the current animation frame
        // We'll set startTimestamp so that "elapsed" starts from 0.
        startTimestamp.current = timestamp - currentTime * 1000;
      }

      // elapsed (ms) = current animationFrame time minus our "start"
      const elapsed = timestamp - startTimestamp.current;
      const newTime = elapsed / 1000; // in seconds
      setCurrentTime(newTime);

      // apply events that have timestamp <= "elapsed"
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const playableEvents = eventsQueueRef.current.filter(
          (e) => e.timestamp <= elapsed
        );
        // apply them
        playableEvents.forEach((ev) => applyEvent(ev, doc));
        // remove from queue
        eventsQueueRef.current = eventsQueueRef.current.filter(
          (e) => e.timestamp > elapsed
        );
      }

      // If we haven't yet reached the full duration, schedule next frame
      if (newTime < duration) {
        rafId.current = requestAnimationFrame(playbackLoop);
      } else {
        // End of playback
        console.log("[Player] playback finished");
        isPlayingRef.current = false;
        setCurrentTime(duration);
      }
    },
    [duration, currentTime]
  );

  /**
   * Dispatch a single event into the iframe.
   * For example, updating the mouse position or applying DOM mutations.
   */
  const applyEvent = (event, doc) => {
    try {
      switch (event.type) {
        case "mousemove":
          updateCursor(doc, event.x, event.y);
          break;
        case "click":
          simulateClick(doc, event.x, event.y);
          break;
        case "mutation":
          applyBatchedMutations(event.mutations, doc);
          break;
        default:
          // no-op or handle more event types here
          break;
      }
    } catch (error) {
      console.error("[Player] Error applying event:", event, error);
    }
  };

  // Moves the "replayer-mouse" element inside the iframe to x,y
  const updateCursor = (doc, x, y) => {
    let cursor = doc.querySelector(".replayer-mouse");
    if (!cursor) {
      cursor = doc.createElement("div");
      cursor.className = "replayer-mouse";
      doc.body.appendChild(cursor);
    }
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };

  // Simulate a user click in the iframe
  const simulateClick = (doc, x, y) => {
    const el = doc.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: x, clientY: y })
      );
    }
  };

  // Public controls
  const handlePlay = () => {
    if (status !== "ready") {
      console.warn("[Player] Not ready to play");
      return;
    }
    // Reset internal state for new playback
    isPlayingRef.current = true;
    startTimestamp.current = null;
    // Refill the events queue so we replay from the start
    eventsQueueRef.current = [...events];
    // Sort them by timestamp again, just in case
    eventsQueueRef.current.sort((a, b) => a.timestamp - b.timestamp);

    // Reset current time to 0
    setCurrentTime(0);

    // Start the animation loop
    rafId.current = requestAnimationFrame(playbackLoop);
  };

  const handlePause = () => {
    isPlayingRef.current = false;
    cancelAnimationFrame(rafId.current);
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
      <div ref={containerRef} style={{ width: "100%", height: "600px" }}>
        {status === "loading" && <p>Loading session...</p>}
        {status === "error" && <p style={{ color: "red" }}>Error: {error}</p>}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={handlePlay} disabled={status !== "ready"}>
          Play
        </button>
        <button onClick={handlePause} disabled={status !== "ready"}>
          Pause
        </button>
        <span style={{ marginLeft: "1rem" }}>
          Time: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
