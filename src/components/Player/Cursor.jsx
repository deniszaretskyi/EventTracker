import { useLayoutEffect, useRef } from "react";

export const Cursor = ({ events, currentTime }) => {
  const cursorRef = useRef(null);
  const lastPosition = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    // creating cursor
    const cursor = document.createElement("div");
    cursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: rgba(255, 0, 0, 0.8);
      border-radius: 50%;
      pointer-events: none;
      transition: transform 0.05s linear;
      z-index: 9999;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(cursor);
    cursorRef.current = cursor;

    return () => {
      document.body.removeChild(cursor);
    };
  }, []);

  useLayoutEffect(() => {
    if (!cursorRef.current || events.length === 0) return;

    // binary search for position
    const targetTime = currentTime * 1000;
    let low = 0;
    let high = events.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (events[mid].timestamp < targetTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const event = events[Math.min(low, events.length - 1)];
    if (
      event &&
      (event.x !== lastPosition.current.x || event.y !== lastPosition.current.y)
    ) {
      cursorRef.current.style.transform = `translate(${event.x}px, ${event.y}px)`;
      lastPosition.current = { x: event.x, y: event.y };
    }
  }, [currentTime, events]);

  return null;
};
