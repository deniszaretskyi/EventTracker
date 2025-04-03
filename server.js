import express from "express";
import cors from "cors";
import { encode, decode } from "@msgpack/msgpack";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const sessions = new Map();

// Middleware
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "X-Session-ID",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.raw({ type: "application/msgpack" }));

// Endpoints
app.post("/api/record", (req, res) => {
  try {
    const sessionId = crypto.randomUUID();
    let data;
    console.log("[/api/record] raw req.body length:", req.body?.length);

    // decode
    if (req.headers["content-type"] === "application/msgpack") {
      try {
        data = decode(new Uint8Array(req.body));
        console.log("[/api/record] Decoded data:", data);
      } catch (e) {
        return res.status(400).json({ error: "Invalid MessagePack format" });
      }
    } else {
      return res.status(400).json({ error: "Unsupported content type" });
    }

    // structure valid
    const isValid =
      data &&
      typeof data === "object" &&
      Array.isArray(data.events) &&
      data.domSnapshot &&
      data.metadata;

    if (!isValid) {
      return res.status(400).json({
        error: "Invalid data structure",
        required: {
          events: "array",
          domSnapshot: "object",
          metadata: "object",
        },
      });
    }

    if (!data.sessionId) {
      return res.status(400).json({ error: "No sessionId" });
    }

    // Session saving
    const session = {
      id: sessionId,
      created: Date.now(),
      ...data,
    };

    sessions.set(sessionId, session);
    res.json({ id: sessionId });
  } catch (error) {
    console.error("Recording error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

app.get("/api/sessions", (req, res) => {
  // sessions - это Map
  const allKeys = Array.from(sessions.keys());
  res.json(allKeys);
});

app.get("/api/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const sessionData = sessions.get(sessionId);
  if (!sessionData) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(sessionData);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
  Server running on port: ${PORT}
   Endpoints:
  - POST /api/record - new session recorder
  - GET /api/sessions/:id - get session
  - GEt /api/sessions - get session list
  `);
});
