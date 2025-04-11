require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://chat-app-client-omega.vercel.app",
      "https://chat-app-server.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://chat-app-client-omega.vercel.app",
      "https://chat-app-server.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Rate limiting middleware
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

let users = [];
let rooms = {
  general: {
    messages: [],
    pinnedMessages: [],
    createdAt: new Date(),
  },
};

function getColorForUsername(username) {
  const colors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#8AC24A",
    "#F06292",
    "#7986CB",
    "#E57373",
  ];
  const hash = crypto.createHash("md5").update(username).digest("hex");
  return colors[parseInt(hash, 16) % colors.length];
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("user-joined", ({ username, roomName = "general" }, callback) => {
    if (!username) {
      return callback({ success: false, error: "Username is required" });
    }

    // Validate username
    if (username.length > 20) {
      return callback({
        success: false,
        error: "Username too long (max 20 chars)",
      });
    }

    const existingUser = users.find((u) => u.username === username);
    if (existingUser) {
      socket.to(existingUser.room).emit("receive-message", {
        username: "System",
        message: `${username} has reconnected`,
        isSystem: true,
        timestamp: new Date(),
      });
    }

    socket.username = username;
    socket.room = roomName;

    if (!rooms[roomName]) {
      rooms[roomName] = {
        messages: [],
        pinnedMessages: [],
        createdAt: new Date(),
      };
      io.emit("room-created", roomName);
    }

    const userData = {
      id: socket.id,
      username,
      avatar: {
        color: existingUser?.avatar?.color || getColorForUsername(username),
        initial: username.charAt(0).toUpperCase(),
      },
      status: "online",
      room: roomName,
      lastActive: new Date(),
    };

    users = users.filter((u) => u.username !== username);
    users.push(userData);

    socket.join(roomName);

    io.to(socket.id).emit("room-data", {
      messages: rooms[roomName].messages.slice(-100), // Send last 100 messages
      pinned: rooms[roomName].pinnedMessages,
      users: users.filter((u) => u.room === roomName),
    });

    socket.to(roomName).emit("receive-message", {
      username: "System",
      message: `${username} has joined the room`,
      isSystem: true,
      timestamp: new Date(),
    });

    io.to(roomName).emit(
      "user-list",
      users.filter((u) => u.room === roomName)
    );

    callback({ success: true });
  });

  socket.on("send-message", ({ message, threadId }, callback) => {
    if (!socket.username || !message || !socket.room) {
      return callback({ success: false, error: "Invalid message data" });
    }

    // Validate message length
    if (message.length > 500) {
      return callback({
        success: false,
        error: "Message too long (max 500 chars)",
      });
    }

    const msgData = {
      id: Date.now().toString(),
      username: socket.username,
      message: message.trim(),
      timestamp: new Date(),
      threadId,
    };

    rooms[socket.room].messages.push(msgData);
    // Keep only the last 200 messages per room
    if (rooms[socket.room].messages.length > 200) {
      rooms[socket.room].messages.shift();
    }

    io.to(socket.room).emit("receive-message", msgData);
    callback({ success: true });
  });

  socket.on("pin-message", ({ messageId }, callback) => {
    const room = rooms[socket.room];
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    const msgToPin = room.messages.find((msg) => msg.id === messageId);
    if (msgToPin && !room.pinnedMessages.find((m) => m.id === messageId)) {
      room.pinnedMessages.push(msgToPin);
      // Keep only the last 10 pinned messages
      if (room.pinnedMessages.length > 10) {
        room.pinnedMessages.shift();
      }
      io.to(socket.room).emit("message-pinned", msgToPin);
      callback({ success: true });
    } else {
      callback({
        success: false,
        error: "Message not found or already pinned",
      });
    }
  });

  socket.on("unpin-message", ({ messageId }, callback) => {
    const room = rooms[socket.room];
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    room.pinnedMessages = room.pinnedMessages.filter(
      (msg) => msg.id !== messageId
    );
    io.to(socket.room).emit("message-unpinned", messageId);
    callback({ success: true });
  });

  socket.on("delete-message", ({ messageId }, callback) => {
    const room = rooms[socket.room];
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    room.messages = room.messages.filter((msg) => msg.id !== messageId);
    room.pinnedMessages = room.pinnedMessages.filter(
      (msg) => msg.id !== messageId
    );
    io.to(socket.room).emit("message-deleted", messageId);
    callback({ success: true });
  });

  socket.on("create-room", (roomName, callback) => {
    if (!roomName || typeof roomName !== "string") {
      return callback({ success: false, error: "Invalid room name" });
    }

    if (rooms[roomName]) {
      return callback({ success: false, error: "Room already exists" });
    }

    rooms[roomName] = {
      messages: [],
      pinnedMessages: [],
      createdAt: new Date(),
    };
    io.emit("room-created", roomName);
    callback({ success: true });
  });

  socket.on("update-status", (status, callback) => {
    if (!socket.username || !["online", "away", "offline"].includes(status)) {
      return callback({ success: false, error: "Invalid status" });
    }

    const user = users.find((u) => u.username === socket.username);
    if (user) {
      user.status = status;
      user.lastActive = new Date();
      io.to(user.room).emit(
        "user-list",
        users.filter((u) => u.room === user.room)
      );
      callback({ success: true });
    } else {
      callback({ success: false, error: "User not found" });
    }
  });

  socket.on("typing", () => {
    if (socket.username && socket.room) {
      socket.to(socket.room).emit("typing", socket.username);
    }
  });

  socket.on("disconnect", () => {
    if (!socket.username) return;

    const user = users.find((u) => u.username === socket.username);
    if (user) {
      user.status = "offline";
      user.lastActive = new Date();

      io.to(user.room).emit(
        "user-list",
        users.filter((u) => u.room === user.room)
      );

      io.to(user.room).emit("receive-message", {
        username: "System",
        message: `${socket.username} has left the chat`,
        isSystem: true,
        timestamp: new Date(),
      });
    }
  });
});

// Clean up inactive users every hour
setInterval(() => {
  const now = new Date();
  users = users.filter((user) => {
    if (
      user.status === "offline" &&
      now - user.lastActive > 24 * 60 * 60 * 1000
    ) {
      io.to(user.room).emit("receive-message", {
        username: "System",
        message: `${user.username} has been removed due to inactivity`,
        isSystem: true,
        timestamp: new Date(),
      });
      return false;
    }
    return true;
  });
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
