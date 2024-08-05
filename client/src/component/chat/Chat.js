import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import io from "socket.io-client";
import axios from "axios";
import config from "../config/config";
import "./Chat.css";
import { CiLogout } from "react-icons/ci";
import { FaVideo } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/actions/authAction";
import { Modal } from "antd";
import VideoCall from "../videoCall/VideoCall";

const socket = io(`${config.API_ROOT}`);

const Chat = () => {
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const { userId } = useSelector((state) => state.auth);
  const [userList, setUserList] = useState([]);
  const [signalingData, setSignalingData] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callRequested, setCallRequested] = useState(false);
  const messageListEndRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    socket.emit("register", userId);

    socket.on("receiveMessage", ({ senderId, message }) => {
      setMessages((prevMessages) => [...prevMessages, { senderId, message }]);
    });

    socket.on("signal", (data) => {
      setSignalingData(data);
    });

    socket.on("videoCallRequest", ({ from }) => {
      Modal.confirm({
        title: `${from} muốn gọi video`,
        okText: 'Chấp nhận',
        cancelText: 'Từ chối',
        onOk() {
          setIsInCall(true);
          setIsInitiator(false);
          setCallRequested(true);
        },
      });
    });

    socket.on("callAccepted", () => {
      setIsInCall(true);
      setIsInitiator(true);
    });

    socket.on("callEnded", () => {
      setIsInCall(false);
      setSignalingData(null);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("signal");
      socket.off("videoCallRequest");
      socket.off("callAccepted");
      socket.off("callEnded");
    };
  }, [userId]);

  useEffect(() => {
    const fetchUserList = async () => {
      try {
        const response = await axios.post(
          `${config.API_ROOT}/api/v1/user/getAll`,
          { userId }
        );
        setUserList(response.data.data);
      } catch (error) {
        console.error("Error fetching user list", error);
      }
    };
    fetchUserList();
  }, [userId]);

  useEffect(() => {
    if (receiverId) {
      const fetchMessages = async () => {
        try {
          const response = await axios.post(
            `${config.API_ROOT}/api/v1/message/getAllMessageOfRoom`,
            { senderId: userId, receiverId }
          );
          setMessages(
            response.data.data.map((m) => ({
              senderId: String(m.SenderId),
              message: m.MessageText,
            }))
          );
        } catch (error) {
          console.error("Error fetching messages", error);
        }
      };
      fetchMessages();
    }
  }, [receiverId, userId]);

  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (message && receiverId) {
      socket.emit("sendMessage", { senderId: userId, receiverId, message });
      setMessage("");
      try {
        const response = await axios.post(
          `${config.API_ROOT}/api/v1/message/addMessage`,
          {
            senderId: userId,
            receiverId,
            message,
          }
        );
        if (response.data.err !== 0) {
          console.log("Lưu tin nhắn thất bại");
        }
      } catch (error) {
        console.error("Máy chủ đang lỗi...", error);
      }
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };

  const showConfirm = () => {
    Modal.confirm({
      title: 'Bạn có chắc chắn muốn đăng xuất?',
      okText: 'Có',
      cancelText: 'Hủy',
      onOk() {
        handleLogout();
      },
    });
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate(`/`);
  };

  const requestVideoCall = () => {
    socket.emit("videoCallRequest", { from: userId, to: receiverId });
    setIsInCall(true);
    setIsInitiator(true);
  };

  const endCall = () => {
    setIsInCall(false);
    setSignalingData(null);
    socket.emit("endCall", { to: receiverId });
  };

  const handleSignalData = (data) => {
    socket.emit("signal", data);
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Danh sách</h2>
        <ul className="user-list">
          {userList.map((user) => (
            <li
              key={user.userId}
              className={`user-item ${
                user.userId === receiverId ? "selected" : ""
              }`}
              onClick={() => setReceiverId(user.userId)}
            >
              {user.userName}
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-area">
        <div className="top-bar">
          <div onClick={requestVideoCall} className="video-call-btn">
            <FaVideo />
            Video Call
          </div>
          <div className="btn-logout" onClick={showConfirm}>
            <CiLogout />
            Logout
          </div>
        </div>
        {isInCall ? (
          <VideoCall
            isInitiator={isInitiator}
            signalingData={signalingData}
            onSignalData={handleSignalData}
            onEndCall={endCall}
          />
        ) : receiverId ? (
          <>          
            <div className="message-list">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${
                    msg.senderId === userId ? "sent" : "received"
                  }`}
                >
                  {msg.message}
                </div>
              ))}
              <div ref={messageListEndRef} />
            </div>
            <div className="input-area">
              <input
                type="text"
                placeholder="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <>Chọn người dùng để nhắn</>
        )}
      </div>
    </div>
  );
};

export default Chat;
