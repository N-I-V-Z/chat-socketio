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
import { Modal, notification, Button } from "antd";

const socket = io(`${config.API_ROOT}`);

const Chat = () => {
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const { userId } = useSelector((state) => state.auth);
  const [userList, setUserList] = useState([]);
  const messageListEndRef = useRef(null);

  const [peerConnection, setPeerConnection] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [calling, setCalling] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    socket.emit("register", userId);

    socket.on("receiveMessage", ({ senderId, message }) => {
      setMessages((prevMessages) => [...prevMessages, { senderId, message }]);
    });

    socket.on("videoCallRequest", ({ from }) => {
      Modal.confirm({
        title: `Bạn có muốn nhận cuộc gọi video từ ${from}?`,
        okText: "Nghe",
        cancelText: "Từ chối",
        onOk() {
          handleAcceptCall(from);
        },
        onCancel() {
          socket.emit("callRejected", { to: from });
        },
      });
    });

    socket.on("callAccepted", ({ from }) => {
      setReceiverId(from);
      startCall();
      setCalling(false);
      setIsCallModalVisible(true);
    });

    socket.on("callRejected", () => {
      notification.info({
        message: "Cuộc gọi video bị từ chối.",
      });
      setCalling(false);
    });

    socket.on("callEnded", () => {
      setIsCallModalVisible(false);
      setCalling(false);
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      notification.info({
        message: "Cuộc gọi đã kết thúc.",
      });
    });

    socket.on("offer", async ({ offer }) => {
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("offer");

      socket.emit("answer", { answer, to: receiverId });
    });

    socket.on("answer", async ({ answer }) => {
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      console.log("answer");
    });

    socket.on("ice-candidate", async (candidate) => {
      if (!peerConnection) return;
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("candidate");
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("videoCallRequest");
      socket.off("callAccepted");
      socket.off("callRejected");
      socket.off("callEnded");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [userId, peerConnection]);

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
          notification.error({
            message: "Lưu tin nhắn thất bại.",
          });
        }
      } catch (error) {
        console.error("Máy chủ đang lỗi...", error);
        notification.error({
          message: "Máy chủ đang lỗi...",
        });
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
      title: "Bạn có chắc chắn muốn đăng xuất?",
      okText: "Có",
      cancelText: "Hủy",
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
    setCalling(true);
  };

  const handleAcceptCall = (from) => {
    setReceiverId(from);
    setIsCallModalVisible(true);
    socket.emit("callAccepted", { from: userId, to: from });
    startCall();
  };

  const handleCallCancel = () => {
    setIsCallModalVisible(false);
    socket.emit("callEnded", { to: receiverId });
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
  };

  const handleCallingCancel = () => {
    socket.emit("callEnded", { to: receiverId });
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setCalling(false);
    setIsCallModalVisible(false);
  };

  const startCall = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          iceCandidate: event.candidate,
          to: receiverId,
        });
      }
    };

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        if (pc.signalingState !== "closed") {
          pc.addTrack(track, stream);
        }
      });
      if (pc) {
        setPeerConnection(pc);
      } else {
        console.error("PeerConnection is null or undefined.");
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer, to: receiverId });
    } catch (error) {
      console.error("Error accessing media devices or starting call:", error);
    }
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
          {receiverId && (
            <div onClick={requestVideoCall} className="video-call-btn">
              <FaVideo />
              Video Call
            </div>
          )}

          <div className="btn-logout" onClick={showConfirm}>
            <CiLogout />
            Logout
          </div>
        </div>
        {receiverId ? (
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
          <div className="no-chat">
            <p>Chọn một người dùng để bắt đầu cuộc trò chuyện.</p>
          </div>
        )}
      </div>

      <Modal
        title="Cuộc gọi video"
        visible={isCallModalVisible}
        onCancel={handleCallCancel}
        footer={[
          <Button key="cancel" onClick={handleCallCancel}>
            Hủy
          </Button>,
        ]}
        width={800}
      >
        <div className="video-call-container">
          <video ref={localVideoRef} autoPlay muted></video>
          <video ref={remoteVideoRef} autoPlay></video>
        </div>
      </Modal>
      <Modal
        title="Đang gọi"
        visible={calling}
        onCancel={handleCallingCancel}
        footer={[
          <Button key="cancel" onClick={handleCallingCancel}>
            Hủy
          </Button>,
        ]}
      >
        <p>Đang chờ người nhận...</p>
      </Modal>
    </div>
  );
};

export default Chat;
