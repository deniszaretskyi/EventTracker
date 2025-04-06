/**
 * Project/src/recorder/userRecorder.js
 *
 * - Используем e.pageX / e.pageY для мыши.
 * - Сериализуем DOM, включая <link> / <style>.
 */

import { encode } from "@msgpack/msgpack";
import { serializeNode } from "../utils/domSnapshot";

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.startTime = null;
    this.sessionId = null;
    this.events = [];
    this.cleanupCallbacks = [];
  }

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

    // Mouse
    const handleMouseMove = (e) => {
      this.events.push({
        type: "mousemove",
        x: e.pageX,
        y: e.pageY,
        timestamp: performance.now() - this.startTime,
      });
    };
    const handleClick = (e) => {
      this.events.push({
        type: "click",
        x: e.pageX,
        y: e.pageY,
        timestamp: performance.now() - this.startTime,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);

    // Scroll (window)
    const handleScroll = () => {
      this.events.push({
        type: "scroll",
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        timestamp: performance.now() - this.startTime,
      });
    };
    window.addEventListener("scroll", handleScroll);

    // Cleanup
    this.cleanupCallbacks.push(() => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
    });

    console.log("[Recorder] Started, sessionId =", this.sessionId);
  }

  stop() {
    if (!this.isRecording) {
      console.warn("[Recorder] stop() called but was not recording.");
      return;
    }
    this.isRecording = false;

    const fullTime = performance.now() - this.startTime;
    console.log(
      `[Recorder] Stopped. Duration=${fullTime.toFixed(1)}ms, Events=${this.events.length}`
    );

    // Cleanup
    this.cleanupCallbacks.forEach((fn) => fn && fn());
    this.cleanupCallbacks = [];

    // Serialize DOM (including <head>, <style>, <link>)
    const domSnapshot = serializeNode(document.documentElement);

    const payload = {
      sessionId: this.sessionId,
      events: this.events,
      domSnapshot,
      metadata: {
        userAgent: navigator.userAgent || "",
        timestamp: Date.now(),
        duration: fullTime,
        // record viewport
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };

    this.uploadToServer(payload);

    // reset
    this.events = [];
    this.startTime = null;
    this.sessionId = null;
  }

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
        console.log("[Recorder] Data uploaded successfully");
      })
      .catch((err) => {
        console.error("[Recorder] Upload failed:", err);
      });
  }
}
