import { initMouseListeners, initMutationObserver } from "./eventHandlers.js";
import { encode } from "@msgpack/msgpack";
import { maskSensitiveFields } from "../utils/maskData";
import { serializeNode, getNodeIdentifier } from "./domUtils";
import { throttle } from "../utils/helpers";

export class Recorder {
  constructor() {
    this.events = [];
    this.domSnapshot = null;
    this.worker = null;
    this.isRecording = false;
    this.cleanupCallbacks = [];
    this.sessionId = crypto.randomUUID();
    this.pendingMutations = [];
    this.eventBuffer = [];
    this.lastFlush = Date.now();

    // Привязка контекста
    this.handleEvent = this.handleEvent.bind(this);
    this.flushMutations = throttle(this._flushMutations.bind(this), 200);
    this.handleWorkerMessage = this.handleWorkerMessage.bind(this);

    // Web Worker
    if (window.Worker) {
      this.worker = new Worker(
        new URL("../../public/workers/serializer.worker.js", import.meta.url),
        { type: "module" }
      );
      this.worker.onmessage = this.handleWorkerMessage;
    }

    this.takeDOMSnapshot();
  }

  takeDOMSnapshot() {
    try {
      this.domSnapshot = serializeNode(document.documentElement);
      console.debug("[Recorder] DOM snapshot created");
    } catch (error) {
      console.error("[Recorder] DOM snapshot error:", error);
    }
  }

  handleWorkerMessage(event) {
    if (!event.data || !this.isRecording) return;

    const payload = {
      events: this.eventBuffer,
      domSnapshot: this.domSnapshot,
      metadata: {
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        timestamp: Date.now(),
      },
    };

    this.uploadToServer(payload);
    this.eventBuffer = [];
  }

  uploadToServer(data) {
    if (!data || data.events.length === 0) return;

    const encoded = encode(data);

    fetch("http://localhost:3001/api/record", {
      method: "POST",
      headers: {
        "Content-Type": "application/msgpack",
        "X-Session-ID": this.sessionId,
      },
      body: encode(data),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.debug("[Recorder] Data uploaded");
      })
      .catch((error) => {
        console.error("[Recorder] Upload failed:", error.message);
      });
  }

  handleEvent(event) {
    if (!this.isRecording) return;

    const processedEvent = {
      ...event,
      sessionId: this.sessionId,
      timestamp: performance.now(),
    };

    this.eventBuffer.push(processedEvent);

    // 50 events in 1 sec
    if (
      this.eventBuffer.length >= 50 ||
      performance.now() - this.lastFlush > 1000
    ) {
      this.worker?.postMessage(this.eventBuffer);
      this.lastFlush = performance.now();
    }
  }

  _flushMutations() {
    if (!Array.isArray(this.pendingMutations)) {
      console.warn("Invalid mutations format");
      this.pendingMutations = [];
      return;
    }

    const mutations = [...this.pendingMutations];
    this.handleEvent({
      type: "mutation",
      mutations,
      timestamp: performance.now(),
    });
    this.pendingMutations = [];
  }

  start() {
    if (this.isRecording) {
      console.warn("[Recorder] Already recording");
      return;
    }

    this.isRecording = true;
    maskSensitiveFields();

    this.cleanupCallbacks = [
      initMouseListeners(this.handleEvent),
      initMutationObserver((mutations) => {
        if (Array.isArray(mutations)) {
          this.pendingMutations.push(...mutations);
        }
        this.flushMutations();
      }),
    ];

    console.log(`[Recorder] Started (${this.sessionId})`);
  }

  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.cleanupCallbacks.forEach((fn) => fn?.());

    if (this.eventBuffer.length > 0) {
      this.worker?.postMessage(this.eventBuffer);
    }
    this._flushMutations();
  }

  destroy() {
    this.stop();
    this.worker?.terminate();
    this.cleanupCallbacks = [];
  }
}
