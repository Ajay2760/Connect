const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://connect-chat-dstxts7de-ajay2760s-projects.vercel.app",
    origin: [process.env.CORS_ORIGIN],
    methods: ["GET", "POST"],
  },
});

// Data stores
const chatRooms = {
  general: {
    messages: [],
    pinned: [],
    users: {},
    messageCount: 0,
  },
};
const onlineUsers = {};

// Helper functions
const getUserAvatar = (username) => {
  const colors = ["#FF6633", "#FFB399", "#FF33FF", "#FFFF99", "#00B3E6"];
  const initial = username.charAt(0).toUpperCase();
  const color = colors[initial.charCodeAt(0) % colors.length];
  return { initial, color };
};

const broadcastRoomUsers = (roomName) => {
  io.to(roomName).emit("room-users", {
    users: Object.values(chatRooms[roomName].users),
    room: roomName,
  });
};

// Socket.io handlers
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room handler
  socket.on("join-room", ({ username, roomName = "general" }) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = {
        messages: [],
        pinned: [],
        users: {},
        messageCount: 0,
      };
    }

    const avatar = getUserAvatar(username);
    onlineUsers[socket.id] = { username, roomName, avatar, status: "online" };
    chatRooms[roomName].users[socket.id] = {
      username,
      avatar,
      status: "online",
    };
    socket.join(roomName);

    // Send room data
    socket.emit("room-data", {
      messages: chatRooms[roomName].messages,
      pinned: chatRooms[roomName].pinned,
      users: Object.values(chatRooms[roomName].users),
      room: roomName,
    });

    // Notify room
    const systemMsg = createSystemMessage(`${username} joined ${roomName}`);
    chatRooms[roomName].messages.push(systemMsg);
    io.to(roomName).emit("receive-message", systemMsg);
    broadcastRoomUsers(roomName);
  });

  // Message handler
  socket.on("send-message", (messageData) => {
    const user = onlineUsers[socket.id];
    if (!user || !chatRooms[user.roomName]) return;

    const message = {
      ...messageData,
      id: Date.now().toString(),
      username: user.username,
      timestamp: new Date().toISOString(),
      room: user.roomName,
      mentions: extractMentions(messageData.message),
      status: "sent",
    };

    chatRooms[user.roomName].messages.push(message);
    chatRooms[user.roomName].messageCount++;
    io.to(user.roomName).emit("receive-message", message);

    // Notify mentioned users
    notifyMentionedUsers(message, user.roomName);
  });

  // Delete message handler
  socket.on("delete-message", ({ messageId, roomName }) => {
    const room = chatRooms[roomName];
    if (!room) return;

    const msgIndex = room.messages.findIndex((m) => m.id === messageId);
    if (msgIndex !== -1) {
      room.messages.splice(msgIndex, 1);
      io.to(roomName).emit("message-deleted", messageId);
    }

    const pinnedIndex = room.pinned.findIndex((m) => m.id === messageId);
    if (pinnedIndex !== -1) {
      room.pinned.splice(pinnedIndex, 1);
      io.to(roomName).emit("message-unpinned", messageId);
    }
  });

  // Pin message handler
  socket.on("pin-message", ({ messageId, roomName }) => {
    const room = chatRooms[roomName];
    if (!room) return;

    const message = room.messages.find((m) => m.id === messageId);
    if (message && !room.pinned.some((m) => m.id === messageId)) {
      room.pinned.push(message);
      io.to(roomName).emit("message-pinned", message);
    }
  });

  // Status update handler
  socket.on("update-status", (status) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    user.status = status;
    chatRooms[user.roomName].users[socket.id].status = status;
    broadcastRoomUsers(user.roomName);
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const room = chatRooms[user.roomName];
    if (room) {
      delete room.users[socket.id];
      const systemMsg = createSystemMessage(
        `${user.username} left ${user.roomName}`
      );
      room.messages.push(systemMsg);
      io.to(user.roomName).emit("receive-message", systemMsg);
      broadcastRoomUsers(user.roomName);
    }
    delete onlineUsers[socket.id];
  });

  // Helper functions
  function createSystemMessage(text) {
    return {
      id: Date.now().toString(),
      username: "System",
      message: text,
      timestamp: new Date().toISOString(),
      isSystem: true,
    };
  }

  function extractMentions(text) {
    return text.match(/@(\w+)/g) || [];
  }

  function notifyMentionedUsers(message, roomName) {
    message.mentions.forEach((mention) => {
      const mentionedUsername = mention.substring(1);
      Object.entries(chatRooms[roomName].users).forEach(([id, userData]) => {
        if (userData.username === mentionedUsername) {
          io.to(id).emit("user-mentioned", {
            message: message.message,
            from: message.username,
            room: roomName,
          });
        }
      });
    });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
