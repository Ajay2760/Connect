import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://192.168.1.5:5000"); // Replace with your backend URL/IP

function App() {
  const [username, setUsername] = useState("");
  const [enteredUsername, setEnteredUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Listen for messages from the server
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // Listen for typing events
    socket.on("typing", (username) => {
      setIsTyping(username ? `${username} is typing...` : "");
    });

    // Listen for updated user list
    socket.on("user-list", (users) => {
      setOnlineUsers(users);
    });

    // Handle user disconnect event
    socket.on("user-left", (leftUsername) => {
      setMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `${leftUsername} has left the chat`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setOnlineUsers((prev) => prev.filter((user) => user !== leftUsername));
    });

    return () => {
      socket.off("receive-message");
      socket.off("typing");
      socket.off("user-list");
      socket.off("user-left");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() && username.trim()) {
      const timestamp = new Date().toLocaleTimeString();
      const messageData = { username, message, timestamp };

      socket.emit("send-message", messageData); // Send message to the server
      setMessage(""); // Clear the input field
      setIsTyping("");
      clearTimeout(typingTimeout);
    } else {
      alert("Please enter both username and message.");
    }
  };

  const handleTyping = () => {
    if (message.trim()) {
      socket.emit("typing", username);

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      const newTimeout = setTimeout(() => {
        socket.emit("typing", "");
      }, 1000);

      setTypingTimeout(newTimeout);
    } else {
      socket.emit("typing", "");
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleJoinChat = () => {
    if (enteredUsername.trim()) {
      setUsername(enteredUsername);
      socket.emit("user-joined", enteredUsername);
    } else {
      alert("Please enter a valid username.");
    }
  };

  const handleExitChat = () => {
    socket.emit("user-left", username);
    setUsername("");
    setMessages([]);
  };

  return (
    <div className={isDarkMode ? "container dark" : "container"}>
      {/* Header */}
      <div className="header">
        <div>
          <button onClick={toggleDarkMode} className="dark-mode-toggle">
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
          {username && (
            <button onClick={handleExitChat} className="exit-button">
              Exit Chat
            </button>
          )}
        </div>
        <h1>Connect - Group Chat</h1>
      </div>

      {/* Welcome Message */}
      {!username && (
        <div className="welcome-message">
          <h2>Welcome to Connect - Group Chat</h2>
          <p>Stay connected with your community!</p>
        </div>
      )}

      {/* Username Input */}
      {!username && (
        <div className="username-container">
          <textarea
            value={enteredUsername}
            onChange={(e) => setEnteredUsername(e.target.value)}
            placeholder="Enter your username"
            rows="2"
          />
          <button onClick={handleJoinChat}>Join Chat</button>
        </div>
      )}

      {/* Chat Box */}
      {username && (
        <>
          <div className="chat-box">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${
                  msg.username === username ? "sent" : "received"
                }`}
              >
                <span className="username">{msg.username}:</span>
                <span className="text">{msg.message}</span>
                <span className="timestamp">{msg.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="input-area">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>

          {/* Typing Indicator */}
          {isTyping && <div className="typing">{isTyping}</div>}

          {/* Online Users */}
          <div className="online-users">
            <h3>Online Users ({onlineUsers.length})</h3>
            <ul>
              {onlineUsers.map((user, index) => (
                <li key={index} style={{ width: `${user.length * 12 + 20}px` }}>
                  {user}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
