import { encode } from "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/+esm";

self.onmessage = function (e) {
  try {
    const events = Array.isArray(e.data) ? e.data : [e.data];
    const encoded = encode(events);
    self.postMessage(encoded);
  } catch (err) {
    console.error("Serialization error:", err);
    self.postMessage({
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
  }
};
