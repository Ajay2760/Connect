import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import "./App.css";

const socket = io("https://connect-app-backend-yahy.onrender.com", {
  transports: ["websocket"],
  withCredentials: true,
});

function App() {
  const [inputUsername, setInputUsername] = useState(""); // New state for input field
  const [username, setUsername] = useState(""); // Existing state for actual username
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
  const messagesEndRef = useRef(null);
  const handleReaction = (messageId, reaction) => {
    socket.emit("react-to-message", { messageId, reaction, roomName: room });
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    socket.on("room-data", ({ messages, pinned, users }) => {
      setMessages(messages);
      setPinnedMessages(pinned);
      setOnlineUsers(users);
    });

    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("message-deleted", (messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on("message-pinned", (message) => {
      setPinnedMessages((prev) => [...prev, message]);
    });

    socket.on("message-unpinned", (messageId) => {
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on("room-users", ({ users }) => {
      setOnlineUsers(users);
    });

    socket.on("user-mentioned", ({ message, from, room: mentionedRoom }) => {
      if (mentionedRoom === room) {
        alert(`You were mentioned by ${from}: ${message}`);
      }
    });

    return () => {
      socket.off("room-data");
      socket.off("receive-message");
      socket.off("message-deleted");
      socket.off("message-pinned");
      socket.off("message-unpinned");
      socket.off("room-users");
      socket.off("user-mentioned");
    };
  }, [room]);

  const sendMessage = () => {
    if (message.trim() && username) {
      socket.emit("send-message", {
        message,
        threadId: activeThread,
      });
      setMessage("");
      setShowEmojiPicker(false);
    }
  };

  const deleteMessage = (messageId) => {
    socket.emit("delete-message", { messageId, roomName: room });
  };

  const pinMessage = (messageId) => {
    socket.emit("pin-message", { messageId, roomName: room });
  };

  const createRoom = () => {
    const newRoom = prompt("Enter new room name:");
    if (newRoom && !rooms.includes(newRoom)) {
      setRooms([...rooms, newRoom]);
      setRoom(newRoom);
      socket.emit("join-room", { username, roomName: newRoom });
    }
  };

  const joinRoom = (roomName) => {
    setRoom(roomName);
    socket.emit("join-room", { username, roomName });
  };

  const updateStatus = (status) => {
    socket.emit("update-status", status);
  };

  const onEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const filteredMessages = messages.filter(
    (msg) =>
      msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIndicator = (status) => {
    switch (status) {
      case "online":
        return <span className="status-indicator online"></span>;
      case "away":
        return <span className="status-indicator away"></span>;
      default:
        return <span className="status-indicator offline"></span>;
    }
  };

  return (
    <div className={`app-container ${darkMode ? "dark-mode" : ""}`}>
      {!username ? (
        <div className="auth-screen">
          <h1>Chat Application</h1>
          <div className="auth-form">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Enter your username"
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputUsername.trim()) {
                  setUsername(inputUsername);
                  joinRoom("general");
                }
              }}
            />
            <button
              onClick={() => {
                if (inputUsername.trim()) {
                  setUsername(inputUsername);
                  joinRoom("general");
                }
              }}
              disabled={!inputUsername.trim()}
            >
              Join Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="sidebar">
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
                + New Chat Room
              </button>
            </div>

            <div className="online-users">
              <h3>Online Homies ({onlineUsers.length})</h3>
              <div className="user-list">
                {onlineUsers.map((user, i) => (
                  <div key={i} className="user-item">
                    <div
                      className="user-avatar"
                      style={{ backgroundColor: user.avatar.color }}
                    >
                      {user.avatar.initial}
                    </div>
                    <span className="username">{user.username}</span>
                    {getStatusIndicator(user.status)}
                  </div>
                ))}
              </div>
            </div>

            <div className="status-controls">
              <h3>Your Status</h3>
              <div className="status-buttons">
                <button
                  className="status-btn online"
                  onClick={() => updateStatus("online")}
                >
                  Online
                </button>
                <button
                  className="status-btn away"
                  onClick={() => updateStatus("away")}
                >
                  Away
                </button>
              </div>
            </div>

            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button
              className="exit-btn"
              onClick={() => {
                setUsername("");
                setMessages([]);
                socket.emit("user-left", { username, room });
              }}
            >
              Exit Chat
            </button>
          </div>

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
                            backgroundColor: onlineUsers.find(
                              (u) => u.username === msg.username
                            )?.avatar.color,
                          }}
                        >
                          {
                            onlineUsers.find((u) => u.username === msg.username)
                              ?.avatar.initial
                          }
                        </div>

                        <span className="username">{msg.username}</span>
                        <button
                          className="unpin-btn"
                          onClick={() => deleteMessage(msg.id)}
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
                        : msg.isSystem
                        ? "system"
                        : "received"
                    }`}
                  >
                    {msg.isSystem ? (
                      <div className="system-message">{msg.message}</div>
                    ) : (
                      <>
                        <div className="message-header">
                          <div
                            className="user-avatar"
                            style={{
                              backgroundColor: onlineUsers.find(
                                (u) => u.username === msg.username
                              )?.avatar.color,
                            }}
                          >
                            {
                              onlineUsers.find(
                                (u) => u.username === msg.username
                              )?.avatar.initial
                            }
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
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder={`Message #${room}`}
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
