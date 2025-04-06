/**
 * Project/src/components/Player/Player.jsx
 *
 * - Восстанавливаем DOM полностью (head + style + link).
 * - При событии scroll => doc.documentElement.scrollLeft/Top = scrollX/Y.
 * - Курсор = position:absolute, top/left = (pageX, pageY).
 * - При желании масштабируем координаты, если iframe меньше/больше исходного окна.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { rebuildDOM } from "../../utils/domSnapshot";

export default function Player({ events, domSnapshot }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
    if (!container) return;

    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.style.cssText = "width:100%; height:600px; border:none;";
    iframe.onload = handleIframeLoad;
    container.appendChild(iframe);
    iframeRef.current = iframe;

    return () => {
      if (container && iframeRef.current) {
        container.removeChild(iframeRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        handleError("No doc in iframeRef");
        return;
      }
      // 1) rebuild DOM
      if (domSnapshot) {
        rebuildDOM(domSnapshot, doc);
        setStatus("ready");
        setError(null);

        const meta = domSnapshot.metadata || {};
        recordedViewport.current.width = meta.viewportWidth || 1920;
        recordedViewport.current.height = meta.viewportHeight || 1080;

        // Duration
        let totalMs = 0;
        if (events && events.length > 0) {
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

        // 2) Optional reset of margin if you want absolutely no offset
        const styleReset = doc.createElement("style");
        styleReset.textContent = `html, body { margin:0; padding:0; }`;
        doc.head.appendChild(styleReset);
      } else {
        handleError("No domSnapshot provided");
      }
    } catch (e) {
      handleError("Iframe load error: " + e.message);
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
      const elapsed = timestamp - startTimestamp.current;
      setCurrentTime(elapsed / 1000);

      const doc = iframeRef.current?.contentDocument;
      if (doc && eventsQueueRef.current.length > 0) {
        const toApply = eventsQueueRef.current.filter(
          (e) => e.timestamp <= elapsed
        );
        toApply.forEach((ev) => applyEvent(ev, doc));
        eventsQueueRef.current = eventsQueueRef.current.filter(
          (e) => e.timestamp > elapsed
        );
      }

      if (elapsed / 1000 < duration) {
        rafId.current = requestAnimationFrame(playbackLoop);
      } else {
        isPlayingRef.current = false;
        setCurrentTime(duration);
      }
    },
    [duration]
  );

  const applyEvent = (event, doc) => {
    switch (event.type) {
      case "mousemove":
        updateCursor(doc, event.x, event.y);
        break;
      case "click":
        simulateClick(doc, event.x, event.y);
        break;
      case "scroll":
        // Restore scroll
        doc.documentElement.scrollLeft = event.scrollX;
        doc.documentElement.scrollTop = event.scrollY;
        break;
      default:
        // ...
        break;
    }
  };

  const updateCursor = (doc, pageX, pageY) => {
    let cursor = doc.querySelector(".replayer-mouse");
    if (!cursor) {
      cursor = doc.createElement("div");
      cursor.className = "replayer-mouse";
      cursor.style.position = "absolute";
      cursor.style.width = "15px";
      cursor.style.height = "15px";
      cursor.style.backgroundColor = "red";
      cursor.style.borderRadius = "50%";
      cursor.style.pointerEvents = "none";
      cursor.style.zIndex = "9999";
      doc.body.appendChild(cursor);
    }

    // (A) Если вы хотите строго абсолютные coords без масштабирования:
    cursor.style.left = pageX + "px";
    cursor.style.top = pageY + "px";

    // (B) Если iframe меньше/больше:
    // const docWidth = doc.documentElement.clientWidth;
    // const docHeight = doc.documentElement.clientHeight;
    // const scaleX = docWidth / recordedViewport.current.width;
    // const scaleY = docHeight / recordedViewport.current.height;
    // cursor.style.left = (pageX * scaleX) + "px";
    // cursor.style.top = (pageY * scaleY) + "px";
  };

  const simulateClick = (doc, pageX, pageY) => {
    // То же самое: если нужен масштаб, применяем
    const el = doc.elementFromPoint(pageX, pageY);
    if (el) {
      el.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: pageX,
          clientY: pageY,
        })
      );
    }
  };

  const handlePlay = () => {
    if (status !== "ready") {
      console.warn("[Player] Not ready to play");
      return;
    }
    isPlayingRef.current = true;
    startTimestamp.current = null;

    eventsQueueRef.current = Array.isArray(events)
      ? [...events].sort((a, b) => a.timestamp - b.timestamp)
      : [];

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
