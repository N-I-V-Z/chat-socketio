import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import io from "socket.io-client";
import axios from "axios";
import config from "../config/config";
import './Chat.css'; // Import CSS file

const socket = io("http://localhost:5000");

const Chat = () => {
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const { userId } = useSelector((state) => state.auth);
  const [userList, setUserList] = useState([]);
  const messageListEndRef = useRef(null); // Create a ref for scrolling to the bottom

  useEffect(() => {
    socket.emit("register", userId);

    socket.on("receiveMessage", ({ senderId, message }) => {
      setMessages((prevMessages) => [...prevMessages, { senderId, message }]);
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, [userId]);

  useEffect(() => {
    const fetchUserList = async () => {
      try {
        const response = await axios.post(`${config.API_ROOT}/api/v1/user/getAll`, {
          userId
        });
        setUserList(response.data.data);
      } catch (error) {
        console.error("Error fetching user list", error);
      }
    };
    fetchUserList();
  }, [userId]);

  useEffect(() => {
    // Scroll to the bottom of the message list whenever messages change
    messageListEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (message && receiverId) {
      socket.emit("sendMessage", { senderId: userId, receiverId, message });
      setMessage("");
    }
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Users</h2>
        <ul className="user-list">
          {userList.map((user) => (
            <li
              key={user.userId}
              className={`user-item ${user.userId === receiverId ? 'selected' : ''}`}
              onClick={() => setReceiverId(user.userId)}
            >
              {user.userName}
            </li>
          ))}
        </ul>
      </div>
      <div className="chat-area">
        <div className="message-list">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.senderId === userId ? 'sent' : 'received'}`}
            >
              {msg.message}
            </div>
          ))}
          {/* Ref for scrolling to the bottom */}
          <div ref={messageListEndRef} />
        </div>
        <div className="input-area">
          <input
            type="text"
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
