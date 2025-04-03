/**
 *
 * Recorder class that captures user interactions (mousemove, click, mutations)
 * plus a DOM snapshot, and sends them to the server. Now it also captures
 * viewport dimensions to enable coordinate scaling in the player.
 */

import { encode } from "@msgpack/msgpack";
import { initMouseListeners, initMutationObserver } from "./eventHandlers";
import { serializeNode } from "../utils/domSnapshot";

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.startTime = null;
    this.sessionId = null;
    this.events = [];
    this.cleanupCallbacks = [];
  }

  /**
   * Start the recording:
   * - sets sessionId
   * - attaches listeners for mouse & DOM mutations
   * - remembers the initial viewport size (innerWidth/innerHeight)
   */
  start() {
    if (this.isRecording) {
      console.warn("[Recorder] Already recording.");
      return;
    }
    this.isRecording = true;
    this.startTime = performance.now();
    this.sessionId = crypto.randomUUID();
    this.events = [];
    this.cleanupCallbacks = [];

    console.log(`[Recorder] Recording started. sessionId=${this.sessionId}`);

    // Capture mouse events
    const stopMouse = initMouseListeners((event) => {
      this.events.push({
        ...event,
        sessionId: this.sessionId,
        timestamp: performance.now() - this.startTime,
      });
    });

    // Capture DOM mutations
    const stopMutations = initMutationObserver((mutationRecords) => {
      this.events.push({
        type: "mutation",
        sessionId: this.sessionId,
        timestamp: performance.now() - this.startTime,
        mutations: mutationRecords,
      });
    });

    this.cleanupCallbacks = [stopMouse, stopMutations];
  }

  /**
   * Stop recording, build the payload, and upload it to the server.
   * Adds viewport size to metadata so the player can scale coordinates.
   */
  stop() {
    if (!this.isRecording) {
      console.warn("[Recorder] stop() called but was not recording.");
      return;
    }
    this.isRecording = false;

    const fullTime = performance.now() - this.startTime;
    console.log(
      `[Recorder] Stopped. Duration=${fullTime.toFixed(1)} ms, Events=${this.events.length}`
    );

    // Cleanup
    this.cleanupCallbacks.forEach((cb) => cb && cb());
    this.cleanupCallbacks = [];

    // Serialize entire DOM as JSON
    const domSnapshot = serializeNode(document.documentElement);

    // Build payload
    const payload = {
      sessionId: this.sessionId,
      events: this.events,
      domSnapshot,
      metadata: {
        userAgent: navigator.userAgent || "",
        timestamp: Date.now(),
        duration: fullTime,

        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };

    this.uploadToServer(payload);

    // Reset
    this.events = [];
    this.startTime = null;
    this.sessionId = null;
  }

  /**
   * Encode payload with msgpack and POST it to /api/record
   */
  uploadToServer(data) {
    const encoded = encode(data);

    fetch("http://localhost:3001/api/record", {
      method: "POST",
      headers: {
        "Content-Type": "application/msgpack",
      },
      body: encoded,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }
        console.log("[Recorder] Data uploaded successfully.");
      })
      .catch((err) => {
        console.error("[Recorder] Upload failed:", err);
      });
  }
}
