/**
 * Project/src/recorder/eventHandlers.js
 *
 * Provides initialization of listeners for mouse, scroll, DOM mutations, etc.
 * Each listener calls `callback(event)` whenever something happens,
 * so the Recorder can store them in this.events.
 */

import { throttle } from "../utils/helpers";

/**
 * Initialize mouse listeners (mousemove, click).
 * Throttled so we don't get thousands of events.
 * @param {Function} callback - function(event) => void
 * @returns {Function} - cleanup function to remove listeners
 */
export function initMouseListeners(callback) {
  // For smoother cursor, set throttle ~16ms (~60 FPS).
  // Adjust as needed for performance vs. smoothness.
  const handleMouseMove = throttle((e) => {
    callback({
      type: "mousemove",
      x: e.clientX,
      y: e.clientY,
      // scrollX, scrollY could be recorded separately if we want to combine in one event,
      // but we'll do a separate "scroll" event below.
      timestamp: performance.now(),
    });
  }, 16);

  const handleClick = (e) => {
    callback({
      type: "click",
      x: e.clientX,
      y: e.clientY,
      timestamp: performance.now(),
    });
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("click", handleClick);

  // Cleanup function
  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("click", handleClick);
  };
}

/**
 * Initialize a scroll listener to capture window scroll changes.
 * @param {Function} callback - function(event) => void
 * @returns {Function} - cleanup function
 */
export function initScrollListener(callback) {
  // Throttle to ~60 FPS as well
  const handleScroll = throttle(() => {
    callback({
      type: "scroll",
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      timestamp: performance.now(),
    });
  }, 16);

  window.addEventListener("scroll", handleScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", handleScroll);
  };
}

/**
 * Initialize a MutationObserver to track DOM changes if needed.
 * For simplicity, let's just store minimal info here.
 * @param {Function} callback - function(mutationRecords) => void
 * @returns {Function} - cleanup function
 */
export function initMutationObserver(callback) {
  const observer = new MutationObserver((mutationsList) => {
    const simplified = Array.from(mutationsList).map((mut) => ({
      type: mut.type,
      targetTag: mut.target?.tagName,
      addedNodesCount: mut.addedNodes?.length,
      removedNodesCount: mut.removedNodes?.length,
    }));
    callback(simplified);
  });

  observer.observe(document.documentElement, {
    childList: true,
    attributes: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
