import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import axios from "axios";
import "./App.css";

// Configure socket connection based on environment
const socket = io(process.env.REACT_APP_SERVER_URL || "http://localhost:5000", {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket"],
});

function App() {
  // State declarations
  const [inputUsername, setInputUsername] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [room, setRoom] = useState("general");
  const [rooms, setRooms] = useState(["general"]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [userStatus, setUserStatus] = useState("online");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [notifications, setNotifications] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add notification
  const addNotification = useCallback((message) => {
    setNotifications((prev) => [...prev, { id: Date.now(), message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 3000);
  }, []);

  // Socket event handlers
  useEffect(() => {
    const handleRoomData = ({ messages, pinned, users }) => {
      setMessages(messages);
      setPinnedMessages(pinned);
      setOnlineUsers(users);
    };

    const handleReceiveMessage = (message) => {
      setMessages((prev) => [...prev, message]);
      if (message.username !== username && !document.hasFocus()) {
        addNotification(`New message from ${message.username}`);
      }
    };

    const handleMessageDeleted = (messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleMessagePinned = (message) => {
      setPinnedMessages((prev) => [...prev, message]);
      addNotification(`Message pinned in ${room}`);
    };

    const handleMessageUnpinned = (messageId) => {
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleRoomCreated = (roomName) => {
      if (!rooms.includes(roomName)) {
        setRooms((prev) => [...prev, roomName]);
        addNotification(`New room created: ${roomName}`);
      }
    };

    const handleUserList = (users) => {
      setOnlineUsers(users);
    };

    const handleTyping = (username) => {
      setTypingUser(username);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => setTypingUser(""), 2000);
    };

    const handleConnect = () => {
      setConnectionStatus("connected");
      if (username) {
        socket.emit("user-joined", { username, roomName: room }, (response) => {
          if (!response.success) {
            addNotification(
              "Failed to reconnect: " + (response.error || "Unknown error")
            );
          }
        });
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      addNotification("Disconnected from server. Attempting to reconnect...");
    };

    const handleConnectError = () => {
      setConnectionStatus("error");
      addNotification("Connection error. Please check your network.");
    };

    socket.on("room-data", handleRoomData);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("message-pinned", handleMessagePinned);
    socket.on("message-unpinned", handleMessageUnpinned);
    socket.on("room-created", handleRoomCreated);
    socket.on("user-list", handleUserList);
    socket.on("typing", handleTyping);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Check server health on initial load
    const checkServerHealth = async () => {
      try {
        const response = await axios.get(
          `${
            process.env.REACT_APP_SERVER_URL || "http://localhost:5000"
          }/health`
        );
        if (response.data.status === "healthy") {
          setConnectionStatus("connected");
        }
      } catch (error) {
        console.error("Server health check failed:", error);
        setConnectionStatus("error");
        addNotification("Server connection failed. Please try again later.");
      }
    };

    checkServerHealth();

    return () => {
      socket.off("room-data", handleRoomData);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("message-pinned", handleMessagePinned);
      socket.off("message-unpinned", handleMessageUnpinned);
      socket.off("room-created", handleRoomCreated);
      socket.off("user-list", handleUserList);
      socket.off("typing", handleTyping);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [username, room, rooms, addNotification]);

  // Event handlers
  const handleJoin = () => {
    if (inputUsername.trim()) {
      socket.emit(
        "user-joined",
        { username: inputUsername, roomName: "general" },
        (response) => {
          if (response.success) {
            setUsername(inputUsername);
          } else {
            addNotification(response.error || "Failed to join chat");
          }
        }
      );
    }
  };

  const updateStatus = (status) => {
    socket.emit("update-status", status, (response) => {
      if (response.success) {
        setUserStatus(status);
        addNotification(`Status updated to ${status}`);
      } else {
        addNotification(response.error || "Failed to update status");
      }
    });
  };

  const sendMessage = () => {
    if (message.trim() && username) {
      socket.emit(
        "send-message",
        {
          message,
          threadId: activeThread,
        },
        (response) => {
          if (response.success) {
            setMessage("");
            setShowEmojiPicker(false);
          } else {
            addNotification(response.error || "Failed to send message");
          }
        }
      );
    }
  };

  const deleteMessage = (messageId) => {
    socket.emit("delete-message", { messageId }, (response) => {
      if (!response.success) {
        addNotification(response.error || "Failed to delete message");
      }
    });
  };

  const pinMessage = (messageId) => {
    socket.emit("pin-message", { messageId }, (response) => {
      if (!response.success) {
        addNotification(response.error || "Failed to pin message");
      }
    });
  };

  const unpinMessage = (messageId) => {
    socket.emit("unpin-message", { messageId }, (response) => {
      if (!response.success) {
        addNotification(response.error || "Failed to unpin message");
      }
    });
  };

  const createRoom = () => {
    const newRoom = prompt("Enter new room name:");
    if (newRoom) {
      if (newRoom.length > 20) {
        addNotification("Room name too long (max 20 characters)");
        return;
      }
      socket.emit("create-room", newRoom, (response) => {
        if (response.success) {
          setRooms([...rooms, newRoom]);
          addNotification(`Room ${newRoom} created`);
        } else {
          addNotification(response.error || "Failed to create room");
        }
      });
    }
  };

  const joinRoom = (roomName) => {
    setRoom(roomName);
    setMessages([]);
    setPinnedMessages([]);
    socket.emit("user-joined", { username, roomName }, (response) => {
      if (!response.success) {
        addNotification(response.error || "Failed to join room");
        setRoom("general"); // Revert to general room if join fails
        socket.emit("user-joined", { username, roomName: "general" });
      }
    });
  };

  const handleTyping = () => {
    if (username && message.trim()) {
      socket.emit("typing");
    }
  };

  const onEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const handleExit = () => {
    socket.emit("update-status", "offline");
    setUsername("");
    socket.disconnect();
    addNotification("You have left the chat");
  };

  const filteredMessages = messages.filter(
    (msg) =>
      msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render
  return (
    <div className={`app-container ${darkMode ? "dark-mode" : ""}`}>
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((notification) => (
          <div key={notification.id} className="notification">
            {notification.message}
          </div>
        ))}
      </div>

      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === "connected"
          ? "Online"
          : connectionStatus === "disconnected"
          ? "Offline"
          : "Connecting..."}
      </div>

      {!username ? (
        <div className="auth-screen">
          <h1>Chat Application</h1>
          <div className="deployment-info">
            <p>
              <strong>Frontend:</strong>{" "}
              <a
                href="https://chat-app-client-omega.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel
              </a>{" "}
              | <strong>Backend:</strong>{" "}
              <a
                href="https://chat-app-server.onrender.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Render
              </a>
            </p>
          </div>
          <div className="auth-form">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Enter your username (max 20 chars)"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={20}
            />
            <button onClick={handleJoin} disabled={!inputUsername.trim()}>
              Join Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="user-profile">
              <div
                className="user-avatar"
                style={{
                  backgroundColor:
                    onlineUsers.find((u) => u.username === username)?.avatar
                      ?.color || "#cccccc",
                }}
              >
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="username">{username}</span>
              <span className={`status-indicator ${userStatus}`}></span>
            </div>

            <div className="room-selector">
              <h3>Chat Rooms</h3>
              <div className="room-list">
                {rooms.map((r) => (
                  <div
                    key={r}
                    className={`room-item ${r === room ? "active" : ""}`}
                    onClick={() => joinRoom(r)}
                  >
                    #{r}
                  </div>
                ))}
              </div>
              <button className="new-room-btn" onClick={createRoom}>
                + New Room
              </button>
            </div>

            <div className="online-users">
              <h3>Online Users ({onlineUsers.length})</h3>
              <div className="user-list">
                {onlineUsers.map((user) => (
                  <div key={user.id} className="user-item">
                    <div
                      className={`user-avatar ${user.status}`}
                      style={{
                        backgroundColor: user.avatar?.color || "#cccccc",
                      }}
                    >
                      {user.avatar?.initial ||
                        user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="username">{user.username}</span>
                    <span
                      className={`status-indicator ${user.status || "offline"}`}
                    ></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="status-controls">
              <h3>Your Status</h3>
              <div className="status-buttons">
                <button
                  className={`status-btn online ${
                    userStatus === "online" ? "active" : ""
                  }`}
                  onClick={() => updateStatus("online")}
                  title="Online"
                >
                  <span className="status-dot online"></span> Online
                </button>
                <button
                  className={`status-btn away ${
                    userStatus === "away" ? "active" : ""
                  }`}
                  onClick={() => updateStatus("away")}
                  title="Away"
                >
                  <span className="status-dot away"></span> Away
                </button>
                <button
                  className={`status-btn offline ${
                    userStatus === "offline" ? "active" : ""
                  }`}
                  onClick={() => updateStatus("offline")}
                  title="Offline"
                >
                  <span className="status-dot offline"></span> Offline
                </button>
              </div>
            </div>

            <div className="app-controls">
              <button
                className="theme-toggle"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
              <button className="exit-btn" onClick={handleExit}>
                Exit Chat
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="main-content">
            <div className="chat-header">
              <h2>#{room}</h2>
              <div className="search-bar">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                />
              </div>
            </div>

            <div className="messages-container">
              {pinnedMessages.length > 0 && (
                <div className="pinned-messages">
                  <h4>📌 Pinned Messages</h4>
                  {pinnedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message ${
                        msg.username === username ? "sent" : "received"
                      } pinned`}
                    >
                      <div className="message-header">
                        <div
                          className="user-avatar"
                          style={{
                            backgroundColor:
                              onlineUsers.find(
                                (u) => u.username === msg.username
                              )?.avatar?.color || "#cccccc",
                          }}
                        >
                          {onlineUsers.find((u) => u.username === msg.username)
                            ?.avatar?.initial ||
                            msg.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="username">{msg.username}</span>
                        <button
                          className="unpin-btn"
                          onClick={() => unpinMessage(msg.id)}
                        >
                          Unpin
                        </button>
                      </div>
                      <div className="message-content">{msg.message}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="messages">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${
                      msg.username === username
                        ? "sent"
                        : msg.username === "System"
                        ? "system"
                        : "received"
                    }`}
                  >
                    {msg.username === "System" ? (
                      <div className="system-message">{msg.message}</div>
                    ) : (
                      <>
                        <div className="message-header">
                          <div
                            className="user-avatar"
                            style={{
                              backgroundColor:
                                onlineUsers.find(
                                  (u) => u.username === msg.username
                                )?.avatar?.color || "#cccccc",
                            }}
                          >
                            {onlineUsers.find(
                              (u) => u.username === msg.username
                            )?.avatar?.initial ||
                              msg.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="username">{msg.username}</span>
                          {msg.username === username ? (
                            <button
                              className="delete-btn"
                              onClick={() => deleteMessage(msg.id)}
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              className="pin-btn"
                              onClick={() => pinMessage(msg.id)}
                            >
                              📌
                            </button>
                          )}
                        </div>
                        <div className="message-content">{msg.message}</div>
                        <div className="message-footer">
                          <span className="timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {typingUser && typingUser !== username && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                    {typingUser} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="message-input-container">
              <div className="emoji-picker-container">
                <button
                  className="emoji-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  😀
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      width={300}
                      height={400}
                    />
                  </div>
                )}
              </div>
              <input
                type="text"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Message #${room} (max 500 chars)`}
                maxLength={500}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!message.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
