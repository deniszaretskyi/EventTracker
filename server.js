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

// Demo Session Data
const DEMO_SESSION = {
  id: "demo",
  created: new Date().toISOString(),
  userAgent: "Demo User Agent",
  events: [
    {
      type: "mousemove",
      x: 100,
      y: 100,
      timestamp: Date.now() - 5000,
    },
    {
      type: "click",
      x: 200,
      y: 200,
      timestamp: Date.now() - 3000,
    },
  ],
  dom: {
    type: "element",
    tag: "div",
    attrs: {},
    children: [
      {
        type: "element",
        tag: "h1",
        attrs: {},
        children: [{ type: "#text", content: "Demo Session" }],
      },
      {
        type: "element",
        tag: "button",
        attrs: {
          class: "demo-button",
        },
        children: [{ type: "#text", content: "Click Me" }],
      },
    ],
  },
};

// Endpoints
app.post("/api/record", (req, res) => {
  try {
    const sessionId = crypto.randomUUID();
    let data;

    // decode
    if (req.headers["content-type"] === "application/msgpack") {
      try {
        data = decode(new Uint8Array(req.body));
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

app.get("/api/sessions/:id", (req, res) => {
  try {
    if (req.params.id === "demo") {
      if (req.headers.accept === "application/msgpack") {
        const encoded = encode(DEMO_SESSION);
        return res.type("application/msgpack").send(encoded);
      }
      return res.json(DEMO_SESSION);
    }

    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (req.headers.accept === "application/msgpack") {
      const encoded = encode(session);
      return res.type("application/msgpack").send(encoded);
    }

    res.json(session);
  } catch (error) {
    console.error("Session fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
  Server running on port: ${PORT}
   Endpoints:
  - POST /api/record - new session recorder
  - GET /api/sessions/:id - get session
  - DEMO: http://localhost:${PORT}/api/sessions/demo
  `);
});
