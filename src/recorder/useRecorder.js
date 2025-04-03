// src/recorder/userRecorder.js
import { encode } from "@msgpack/msgpack";
import { initMouseListeners, initMutationObserver } from "./eventHandlers";

/**
 * Recorder class is responsible for capturing user interactions (mouse/mutations)
 * and then uploading them (with a DOM snapshot) to the server.
 *
 * Key points in this implementation:
 * - We store a 'startTime' when recording begins.
 * - Every event gets a relative 'timestamp' = performance.now() - startTime.
 * - On stop, we save the total duration in metadata.duration.
 */
export class Recorder {
  constructor() {
    this.isRecording = false;
    this.startTime = null; // Will store the performance.now() at start
    this.sessionId = null;
    this.events = [];
    this.cleanupCallbacks = [];
  }

  /**
   * Start recording a new session. Generates a new sessionId
   * and initializes event listeners (mouse, mutations, etc.).
   */
  start() {
    if (this.isRecording) {
      console.warn("[Recorder] Already recording");
      return;
    }

    this.isRecording = true;
    this.startTime = performance.now(); // Mark the start
    this.sessionId = crypto.randomUUID();

    console.log(`[Recorder] Started recording. sessionId=${this.sessionId}`);

    // Listen to mouse (move, click, etc.)
    const stopMouse = initMouseListeners((event) => {
      // Store each event with a timestamp relative to startTime
      const relativeTime = performance.now() - this.startTime;
      this.events.push({
        ...event,
        timestamp: relativeTime,
        sessionId: this.sessionId,
      });
    });

    // Listen to DOM mutations
    const stopMutations = initMutationObserver((mutationRecords) => {
      const relativeTime = performance.now() - this.startTime;
      this.events.push({
        type: "mutation",
        sessionId: this.sessionId,
        timestamp: relativeTime,
        mutations: mutationRecords,
      });
    });

    // We'll keep references to these cleanup functions
    // so that we can remove the listeners later.
    this.cleanupCallbacks = [stopMouse, stopMutations];
  }

  /**
   * Stop the recording, gather the data, and send it to the server.
   */
  stop() {
    if (!this.isRecording) {
      console.warn("[Recorder] Called stop() but was not recording.");
      return;
    }
    this.isRecording = false;

    // Calculate the actual full duration of the recording
    const fullTime = performance.now() - this.startTime;

    console.log(
      `[Recorder] Stopped. Total events=${this.events.length}, duration=${(fullTime / 1000).toFixed(1)}s`
    );

    // Clean up all event listeners
    this.cleanupCallbacks.forEach((fn) => fn && fn());
    this.cleanupCallbacks = [];

    // Here we can serialize the DOM or just store a placeholder
    // for demonstration purposes:
    const domSnapshot = "<html><body>Recorded Snapshot</body></html>";

    // Prepare payload for uploading
    const payload = {
      sessionId: this.sessionId,
      events: this.events,
      domSnapshot: domSnapshot,
      metadata: {
        userAgent: window.navigator.userAgent || "",
        timestamp: Date.now(), // typical "real world" time
        duration: fullTime, // total length in milliseconds
      },
    };

    this.uploadToServer(payload);

    // Clear memory
    this.events = [];
    this.startTime = null;
    this.sessionId = null;
  }

  /**
   * Actually send the recorded data to the server, encoded with msgpack.
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
        console.log("[Recorder] Data successfully uploaded to server.");
      })
      .catch((err) => {
        console.error("[Recorder] Upload failed:", err);
      });
  }
}
