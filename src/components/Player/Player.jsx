/**
 *
 * Player component to reconstruct the recorded DOM inside an iframe
 * and replay the user events in a timeline.
 *
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { rebuildDOM } from "../../utils/domSnapshot";

export default function Player({ events, domSnapshot }) {
  const [status, setStatus] = useState("idle"); // "idle" | "loading" | "ready" | "error"
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds

  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const rafId = useRef(null);
  const startTimestamp = useRef(null);
  const isPlayingRef = useRef(false);
  const eventsQueueRef = useRef([]);

  const recordedViewport = useRef({ width: 0, height: 0 });

  useEffect(() => {
    setStatus("loading");

    const container = containerRef.current;
    if (!container) {
      console.warn("[Player] containerRef is null. Cannot create iframe.");
      return;
    }

    // Create a new iframe
    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.style.cssText = "width:100%; height:600px; border:none;";
    iframe.onload = handleIframeLoad;
    iframe.onerror = () => handleError("Iframe load error");
    container.appendChild(iframe);
    iframeRef.current = iframe;

    // Cleanup
    return () => {
      if (container && iframeRef.current) {
        container.removeChild(iframeRef.current);
        iframeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) {
        handleError("No iframeRef after load");
        return;
      }
      const doc = iframe.contentDocument;
      if (!doc) {
        handleError("No contentDocument in iframe");
        return;
      }

      // Rebuild the recorded DOM
      if (domSnapshot) {
        rebuildDOM(domSnapshot, doc);
        setStatus("ready");
        setError(null);

        // Grab metadata with viewport info
        const meta = domSnapshot.metadata || {};
        recordedViewport.current.width = meta.viewportWidth || 1920;
        recordedViewport.current.height = meta.viewportHeight || 1080;

        // Prepare playback duration
        let totalMs = 0;
        if (Array.isArray(events) && events.length > 0) {
          eventsQueueRef.current = [...events].sort(
            (a, b) => a.timestamp - b.timestamp
          );
          const firstT = eventsQueueRef.current[0].timestamp;
          const lastT =
            eventsQueueRef.current[eventsQueueRef.current.length - 1].timestamp;
          totalMs = lastT - firstT;
        }
        if (typeof meta.duration === "number") {
          totalMs = Math.max(totalMs, meta.duration);
        }
        setDuration(totalMs / 1000);
      } else {
        handleError("No domSnapshot provided");
      }
    } catch (err) {
      handleError("Failed to rebuild DOM: " + err.message);
    }
  };

  const handleError = (msg) => {
    console.error("[Player] error:", msg);
    setStatus("error");
    setError(msg);
  };

  const playbackLoop = useCallback(
    (timestamp) => {
      if (!isPlayingRef.current) return;

      if (!startTimestamp.current) {
        startTimestamp.current = timestamp;
      }

      const elapsedMs = timestamp - startTimestamp.current;
      const elapsedSec = elapsedMs / 1000;
      setCurrentTime(elapsedSec);

      const doc = iframeRef.current?.contentDocument;
      if (doc && eventsQueueRef.current.length > 0) {
        // gather events up to 'elapsedMs'
        const toApply = eventsQueueRef.current.filter(
          (e) => e.timestamp <= elapsedMs
        );

        // apply them
        toApply.forEach((ev) => applyEvent(ev, doc));

        // remove them from queue
        eventsQueueRef.current = eventsQueueRef.current.filter(
          (e) => e.timestamp > elapsedMs
        );
      }

      // if we've reached the total duration, end
      if (elapsedSec < duration) {
        rafId.current = requestAnimationFrame(playbackLoop);
      } else {
        console.log("[Player] Playback finished.");
        isPlayingRef.current = false;
        setCurrentTime(duration);
      }
    },
    [duration]
  );

  /**
   * applyEvent: handles replay of each recorded event (mousemove, click, etc.)
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
          console.log("[Player] Mutation event replay not implemented yet.");
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("[Player] Error applying event:", error);
    }
  };

  const updateCursor = (doc, x, y) => {
    let cursor = doc.querySelector(".replayer-mouse");
    if (!cursor) {
      cursor = doc.createElement("div");
      cursor.className = "replayer-mouse";
      // style the cursor
      cursor.style.position = "absolute";
      cursor.style.width = "15px";
      cursor.style.height = "15px";
      cursor.style.backgroundColor = "red";
      cursor.style.borderRadius = "50%";
      cursor.style.pointerEvents = "none";
      cursor.style.zIndex = "9999";
      doc.body.appendChild(cursor);
    }

    // 1) Get recorded viewport
    const recordedWidth = recordedViewport.current.width;
    const recordedHeight = recordedViewport.current.height;

    // 2) Get current iframe size
    const docWidth = doc.documentElement.clientWidth;
    const docHeight = doc.documentElement.clientHeight;

    // 3) Calculate scale factor
    const scaleX = docWidth / recordedWidth;
    const scaleY = docHeight / recordedHeight;

    // 4) Apply scaled coordinates so the cursor is always in view
    const finalX = x * scaleX;
    const finalY = y * scaleY;

    cursor.style.transform = `translate(${finalX}px, ${finalY}px)`;
  };

  /**
   * simulateClick: trigger a click event inside the iframe at scaled coords
   */
  const simulateClick = (doc, x, y) => {
    // Scale coords similarly if you want clicks in the right place
    const recordedWidth = recordedViewport.current.width;
    const recordedHeight = recordedViewport.current.height;

    const docWidth = doc.documentElement.clientWidth;
    const docHeight = doc.documentElement.clientHeight;

    const scaleX = docWidth / recordedWidth;
    const scaleY = docHeight / recordedHeight;

    const finalX = x * scaleX;
    const finalY = y * scaleY;

    const el = doc.elementFromPoint(finalX, finalY);
    if (el) {
      el.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: finalX,
          clientY: finalY,
        })
      );
    }
  };

  // Public controls
  const handlePlay = () => {
    if (status !== "ready") {
      console.warn("[Player] Not ready to play");
      return;
    }
    isPlayingRef.current = true;
    startTimestamp.current = null;

    if (Array.isArray(events)) {
      eventsQueueRef.current = [...events].sort(
        (a, b) => a.timestamp - b.timestamp
      );
    } else {
      eventsQueueRef.current = [];
    }

    setCurrentTime(0);
    rafId.current = requestAnimationFrame(playbackLoop);
  };

  const handlePause = () => {
    isPlayingRef.current = false;
    cancelAnimationFrame(rafId.current);
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
      <div ref={containerRef} style={{ width: "100%", height: "600px" }}>
        {status === "loading" && <p>Loading Player...</p>}
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
