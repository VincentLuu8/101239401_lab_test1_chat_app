require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const ROOMS = require("./config/rooms");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// ---- Express basics
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve static assets
app.use("/public", express.static(path.join(__dirname, "public")));

// pages
app.get("/", (req, res) => res.redirect("/login"));
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "view", "signup.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "view", "login.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "view", "chat.html")));

// APIs
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// ---- Mongo
async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
  server.listen(process.env.PORT || 3000, () => {
    console.log(`✅ Server running on http://localhost:${process.env.PORT || 3000}`);
  });
}

function verifySocketToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ---- Socket auth middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing token"));

    const payload = verifySocketToken(token);
    socket.user = payload; // { username, firstname, lastname }
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const username = socket.user.username;

  // personal room so we can DM reliably
  socket.join(`user:${username}`);
  socket.data.currentRoom = null;

  socket.emit("session:ready", { username });

  socket.on("room:join", async (room, ack) => {
    try {
      if (!ROOMS.includes(room)) {
        if (ack) return ack({ ok: false, message: "Unknown room." });
        return;
      }

      // leave old room if any
      if (socket.data.currentRoom) socket.leave(socket.data.currentRoom);

      socket.join(room);
      socket.data.currentRoom = room;

      if (ack) ack({ ok: true, room });
      io.to(room).emit("room:system", { room, message: `${username} joined.` });
    } catch (err) {
      if (ack) ack({ ok: false, message: "Could not join room." });
    }
  });

  socket.on("room:leave", (ack) => {
    const room = socket.data.currentRoom;
    if (room) {
      socket.leave(room);
      socket.data.currentRoom = null;
      io.to(room).emit("room:system", { room, message: `${username} left.` });
    }
    if (ack) ack({ ok: true });
  });

  // Group message
  socket.on("message:group", async (payload, ack) => {
    try {
      const room = socket.data.currentRoom;
      const text = (payload?.message || "").trim();

      if (!room) return ack?.({ ok: false, message: "Join a room first." });
      if (!ROOMS.includes(room)) return ack?.({ ok: false, message: "Unknown room." });
      if (!text) return ack?.({ ok: false, message: "Empty message." });

      const doc = await GroupMessage.create({
        from_user: username,
        room,
        message: text
      });

      io.to(room).emit("message:group", {
        _id: doc._id,
        from_user: doc.from_user,
        room: doc.room,
        message: doc.message,
        date_sent: doc.date_sent
      });

      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, message: "Failed to send group message." });
    }
  });

  // Private message
  socket.on("message:private", async (payload, ack) => {
    try {
      const to_user = (payload?.to_user || "").trim();
      const text = (payload?.message || "").trim();

      if (!to_user) return ack?.({ ok: false, message: "Missing recipient." });
      if (!text) return ack?.({ ok: false, message: "Empty message." });

      const doc = await PrivateMessage.create({
        from_user: username,
        to_user,
        message: text
      });

      const outgoing = {
        _id: doc._id,
        from_user: doc.from_user,
        to_user: doc.to_user,
        message: doc.message,
        date_sent: doc.date_sent
      };

      // send to both sides (so sender sees it immediately too)
      io.to(`user:${to_user}`).emit("message:private", outgoing);
      io.to(`user:${username}`).emit("message:private", outgoing);

      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, message: "Failed to send private message." });
    }
  });

  // Typing indicator (private only, as required)
  socket.on("typing:private", (payload) => {
    const to_user = (payload?.to_user || "").trim();
    const isTyping = Boolean(payload?.isTyping);

    if (!to_user) return;

    io.to(`user:${to_user}`).emit("typing:private", {
      from_user: username,
      isTyping
    });
  });

  socket.on("disconnect", () => {
    // optional: broadcast leaving, etc.
  });
});

start().catch((err) => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
