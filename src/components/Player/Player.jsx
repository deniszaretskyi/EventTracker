import { useState, useEffect, useRef, useCallback } from "react";
import {
  rebuildDOM,
  applyBatchedMutations,
} from "../../utils/domReconstructor";
import { Cursor } from "./Cursor";
import { Controls } from "./Controls";

export const Player = ({ sessionId, autoPlay = false, initialData }) => {
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    speed: 1.0,
    duration: 0,
  });

  const [loadingState, setLoadingState] = useState({
    status: "idle",
    error: null,
  });

  const iframeRef = useRef(null);
  const eventsQueue = useRef([]);
  const rafId = useRef(null);
  const startTimestamp = useRef(0);
  const playbackStateRef = useRef(playbackState);
  const containerRef = useRef(null);
  const initAttempts = useRef(0);
  const retryTimeout = useRef(null);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const initIframe = useCallback((dom) => {
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY = 300;
    setLoadingState({ status: "loading", error: null });

    const cleanup = () => {
      if (iframeRef.current) {
        containerRef.current?.removeChild(iframeRef.current);
        iframeRef.current = null;
      }
      clearTimeout(retryTimeout.current);
    };

    const initialize = () => {
      cleanup();
      initAttempts.current = 0;

      try {
        if (!containerRef.current) throw new Error("Контейнер не найден");

        iframeRef.current = document.createElement("iframe");
        iframeRef.current.className = "session-iframe";
        iframeRef.current.sandbox = "allow-scripts";
        iframeRef.current.style.cssText = `
          visibility: hidden;
          width: 100%;
          height: 100%;
          border: none;
        `;

        // Обработчики событий iframe
        iframeRef.current.onload = () => handleIframeLoad(dom);
        iframeRef.current.onerror = () => handleError("Ошибка загрузки iframe");

        containerRef.current.appendChild(iframeRef.current);
      } catch (error) {
        handleError(error.message);
      }
    };

    const handleIframeLoad = (dom) => {
      try {
        const doc = iframeRef.current.contentDocument;
        if (!doc) throw new Error("Документ не доступен");

        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
              <style>
                html, body { margin: 0; overflow: hidden; width: 100%; height: 100%; }
                .replayer-mouse {
                  position: absolute;
                  width: 15px;
                  height: 15px;
                  background: #ff0000;
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

        setTimeout(() => {
          if (doc.body) {
            rebuildDOM(dom, doc);
            iframeRef.current.style.visibility = "visible";
            setLoadingState({ status: "ready", error: null });
          }
        }, 100);
      } catch (error) {
        handleError(`Ошибка контента: ${error.message}`);
      }
    };

    const handleError = (message) => {
      if (initAttempts.current < MAX_ATTEMPTS) {
        initAttempts.current += 1;
        retryTimeout.current = setTimeout(
          initialize,
          BASE_DELAY * initAttempts.current
        );
      } else {
        setLoadingState({ status: "error", error: message });
        cleanup();
      }
    };

    initialize();

    return cleanup;
  }, []);

  useEffect(() => {
    if (!initialData?.dom || !initialData?.events) return;

    // Валидация данных
    const isValid = initialData.events.every(
      (e) =>
        e.timestamp !== undefined &&
        ["mousemove", "click", "mutation"].includes(e.type) &&
        (e.type !== "mousemove" ||
          (typeof e.x === "number" && typeof e.y === "number"))
    );

    if (!isValid) {
      setLoadingState({ status: "error", error: "Неверный формат данных" });
      return;
    }

    eventsQueue.current = [...initialData.events].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    setPlaybackState((prev) => ({
      ...prev,
      duration:
        eventsQueue.current.length > 0
          ? (eventsQueue.current.slice(-1)[0].timestamp -
              eventsQueue.current[0].timestamp) /
            1000
          : 0,
    }));

    initIframe(initialData.dom);

    return () => {
      if (iframeRef.current) {
        containerRef.current?.removeChild(iframeRef.current);
        iframeRef.current = null;
      }
    };
  }, [initialData, initIframe]);

  // Play logic
  const playbackLoop = useCallback((timestamp) => {
    if (!playbackStateRef.current.isPlaying || !iframeRef.current) return;

    if (!startTimestamp.current) {
      startTimestamp.current =
        timestamp - playbackStateRef.current.currentTime * 1000;
    }

    const elapsed =
      (timestamp - startTimestamp.current) * playbackStateRef.current.speed;
    const currentTime = Math.min(
      elapsed / 1000,
      playbackStateRef.current.duration
    );

    setPlaybackState((prev) => ({
      ...prev,
      currentTime: currentTime,
    }));

    const targetTimestamp = eventsQueue.current[0]?.timestamp + elapsed;
    const currentEvents = eventsQueue.current.filter(
      (e) => e.timestamp <= targetTimestamp
    );

    if (currentEvents.length > 0) {
      processEvents(currentEvents);
      eventsQueue.current = eventsQueue.current.filter(
        (e) => e.timestamp > targetTimestamp
      );
    }

    if (currentTime < playbackStateRef.current.duration) {
      rafId.current = requestAnimationFrame(playbackLoop);
    } else {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  // Event handler
  const processEvents = useCallback((events) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    events.forEach((event) => {
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

          case "scroll":
            doc.defaultView?.scrollTo(event.scrollX, event.scrollY);
            break;
        }
      } catch (error) {
        console.error("Error event handling:", event.type, error);
      }
    });
  }, []);

  const updateCursor = (doc, x, y) => {
    let cursor = doc.querySelector(".replayer-mouse");
    if (!cursor) {
      cursor = doc.createElement("div");
      cursor.className = "replayer-mouse";
      doc.body.appendChild(cursor);
    }
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };

  const simulateClick = (doc, x, y) => {
    const element = doc.elementFromPoint(x, y);
    if (element) {
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: x,
          clientY: y,
        })
      );
    }
  };

  // Play pause
  const handlePlayPause = useCallback(() => {
    setPlaybackState((prev) => {
      const newIsPlaying = !prev.isPlaying;

      if (newIsPlaying) {
        eventsQueue.current = [...initialData.events].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        startTimestamp.current = performance.now() - prev.currentTime * 1000;
        rafId.current = requestAnimationFrame(playbackLoop);
      } else {
        cancelAnimationFrame(rafId.current);
      }

      return { ...prev, isPlaying: newIsPlaying };
    });
  }, [initialData?.events, playbackLoop]);

  const handleSeek = useCallback(
    (delta) => {
      setPlaybackState((prev) => {
        const newTime = Math.max(
          0,
          Math.min(prev.currentTime + delta, prev.duration)
        );

        eventsQueue.current = [...initialData.events]
          .filter(
            (e) =>
              e.timestamp >= initialData.events[0].timestamp + newTime * 1000
          )
          .sort((a, b) => a.timestamp - b.timestamp);

        startTimestamp.current = performance.now() - newTime * 1000;
        return { ...prev, currentTime: newTime };
      });
    },
    [initialData?.events]
  );

  return (
    <div className="player-container" ref={containerRef}>
      <div
        className="iframe-wrapper"
        style={{ width: "100%", height: "600px" }}
      >
        {loadingState.status === "error" && (
          <div className="error-overlay">
            <h3>PlayBack Error</h3>
            <p>{loadingState.error}</p>
            <button
              onClick={() => initIframe(initialData.dom)}
              className="retry-button"
            >
              Try again
            </button>
          </div>
        )}

        {loadingState.status === "loading" && (
          <div className="loading-overlay">
            <div className="loader-spinner" />
            <p>Loading session...</p>
          </div>
        )}

        {loadingState.status === "ready" && initialData && (
          <Cursor
            events={initialData.events.filter((e) => e.type === "mousemove")}
            currentTime={playbackState.currentTime}
          />
        )}
      </div>

      <Controls
        isPlaying={playbackState.isPlaying}
        duration={playbackState.duration}
        currentTime={playbackState.currentTime}
        playbackSpeed={playbackState.speed}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={(speed) =>
          setPlaybackState((prev) => ({ ...prev, speed }))
        }
        disabled={loadingState.status !== "ready"}
      />
    </div>
  );
};
