import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import io from "socket.io-client";
import config from "../config/config";
import api, {
  clearAccessToken,
  getAccessToken,
  refreshAccessToken,
} from "../../api/client";
import "./Chat.css";
import { CiLogout } from "react-icons/ci";
import { FaVideo } from "react-icons/fa6";
import { IoCall } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { logout } from "../store/actions/authAction";
import { Modal, notification, Button, message } from "antd";
const antdMessage = message; // trùng tên biến nên khai báo 1 biến khác để dùng

const Chat = () => {
  // chuyển trang và lưu redux
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const socket = useMemo(
    () =>
      io(config.API_ROOT, {
        autoConnect: false,
        auth: (callback) => callback({ token: getAccessToken() }),
      }),
    []
  );
  // thông tin người dùng, room
  const [receiverId, setReceiverId] = useState("");
  const { user } = useSelector((state) => state.auth);
  const [userList, setUserList] = useState([]);
  // liên quan đến tin nhắn
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const messageListEndRef = useRef(null);
  // liên quan đến kết nối video call
  const [peerConnection, setPeerConnection] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    const handleExpiredConnection = async () => {
      try {
        await refreshAccessToken();
        socket.connect();
      } catch (error) {
        if (error.response?.status === 401) {
          clearAccessToken();
          dispatch(logout());
          navigate("/", { replace: true });
          return;
        }
        notification.error({
          message: "Không thể gia hạn phiên đăng nhập. Vui lòng thử lại.",
        });
      }
    };
    const handleConnectError = (error) => {
      if (error.data?.code === "ACCESS_TOKEN_EXPIRED") {
        handleExpiredConnection();
      }
    };
    const handleDisconnect = (reason) => {
      if (reason === "io server disconnect") {
        handleExpiredConnection();
      }
    };

    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.connect();

    return () => {
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [dispatch, navigate, socket]);

  // hàm xử lý khi cuộc gọi thật sự bắt đầu
  const startCall = useCallback(
    async (video) => {
      // tạo 1 peer
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
      // lấy thông tin từ video, audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video ?? false,
          audio: true,
        });

        localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach((track) => {
          if (pc.signalingState !== "closed") {
            pc.addTrack(track, stream);
          }
        });

        // set vào peer connection
        setPeerConnection(pc);
        // tạo 1 offer để set vào local description trong peer của mình (mình cần phải set thêm 1 remote description vào trong peer, đó là offer của người mình muốn kết nối để gọi)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // sau khi set vào local xong thì gửi offer đó qua cho người cần kết nối để họ set vào remote description trong peer của họ (dùng real time để gửi)
        socket.emit("offer", { offer, to: receiverId });
      } catch (error) {
        antdMessage.error("Error accessing media devices or starting call"); // báo lỗi khi không có quyền truy cập camera hoặc audio
      }
    },
    [receiverId, socket]
  );

  // useEffect này dùng để đón các thông tin từ socket gửi về
  useEffect(() => {
    // hàm xử lý sau khi chấp nhận yêu cầu cuộc gọi
    const handleAcceptCall = (from, video) => {
      setReceiverId(from);
      setIsCallModalVisible(true);
      // gửi yêu cầu đã được chấp nhận về cho người kia
      socket.emit("callAccepted", {
        from: user.userId,
        to: from,
        video: video,
      });
      startCall(video);
    };
    // người dùng tự động đăng kí vào một mảng tạm được lưu ở server
    // nhận tin nhắn
    socket.on("receiveMessage", ({ senderId, message }) => {
      setMessages((prevMessages) => [...prevMessages, { senderId, message }]);
    });
    // nhận yêu cầu call video
    socket.on("videoCallRequest", ({ from, name, video }) => {
      Modal.confirm({
        title: `Bạn có muốn nhận cuộc gọi ${video ? "video" : ""} từ ${name}?`,
        okText: "Nghe",
        cancelText: "Từ chối",
        onOk() {
          // nếu đồng ý thì gọi hàm handleAcceptCall() để bắt đầu cuộc gọi
          handleAcceptCall(from, video);
        },
        // không đồng ý thì gửi thông tin không đồng ý cho người kia
        onCancel() {
          socket.emit("callRejected", { to: from });
        },
      });
    });
    // nhận thông tin yêu cầu call đã được đồng ý
    socket.on("callAccepted", ({ from, video }) => {
      setReceiverId(from);
      setCalling(false);
      startCall(video);
      setIsCallModalVisible(true);
    });
    // nhận thông tin yêu cầu call bị từ chối
    socket.on("callRejected", () => {
      notification.info({
        message: "Cuộc gọi video bị từ chối.",
      });
      setCalling(false);
    });
    // nhận thông tin khi cuộc gọi bị kết thúc
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
    // nhận offer của người kia để lưu vào remote description trong peer connection của mình
    socket.on("offer", async ({ offer }) => {
      if (!peerConnection) return;

      try {
        // set offer nhận được vào remote description của mình
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        // sau đó tạo một offer của mình và set vào local description trong peer connection
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        // sau đó gửi offer của mình lại cho người kia để họ set vào remote description của họ
        socket.emit("answer", { answer, to: receiverId });
      } catch (error) {
        console.log(error);
      }
    });
    // nhận offer sau khi mình gửi offer cho họ
    socket.on("answer", async ({ answer }) => {
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (error) {
        console.log(error);
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      if (!peerConnection) return;
      if (!candidate.iceCandidate) return;
      try {
        const iceCandidate = candidate.iceCandidate;
        await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
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
  }, [user, peerConnection, receiverId, startCall, socket]);

  useEffect(() => {
    // lấy list user đã được lưu
    const fetchUserList = async () => {
      try {
        const response = await api.post("/api/v1/user/getAll");
        setUserList(response.data.data);
      } catch (error) {
        console.error("Error fetching user list", error);
      }
    };
    fetchUserList();
  }, [user]);

  useEffect(() => {
    // lấy lại những tin nhắn cũ trong phòng
    if (receiverId) {
      const fetchMessages = async () => {
        try {
          const response = await api.post(
            "/api/v1/message/getAllMessageOfRoom",
            { receiverId }
          );
          setMessages(
            response.data.data.map((m) => ({
              senderId: Number(m.SenderId),
              message: m.MessageText,
            }))
          );
        } catch (error) {
          console.error("Error fetching messages", error);
        }
      };
      fetchMessages();
    }
  }, [receiverId, user]);

  // cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // xử lý gửi tin nhắn
  const sendMessage = async () => {
    if (message && receiverId) {
      socket.emit("sendMessage", {
        receiverId,
        message,
      });
      setMessage("");
      try {
        await api.post("/api/v1/message/addMessage", {
          receiverId,
          message,
        });
      } catch (error) {
        console.error("Máy chủ đang lỗi...", error);
        notification.error({
          message: "Máy chủ đang lỗi...",
        });
      }
    }
  };

  // nhấn enter để gửi tin
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };
  // popup hỏi đăng xuất
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
  // đăng xuất
  const handleLogout = async () => {
    try {
      await api.post("/api/v1/user/logout");
    } catch (error) {
      console.error("Could not revoke the refresh token", error);
      notification.error({
        message: "Đăng xuất không thành công. Vui lòng thử lại.",
      });
      return;
    }

    clearAccessToken();
    dispatch(logout());
    navigate("/", { replace: true });
  };
  // gửi yêu cầu call video
  const requestVideoCall = ({ video }) => {
    socket.emit("videoCallRequest", {
      to: receiverId,
      video: video,
    });
    setCalling(true);
  };
  // hủy call
  const handleCallCancel = () => {
    setIsCallModalVisible(false);
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    socket.emit("callEnded", { to: receiverId });
  };
  // hủy khi đang chờ chấp nhận call
  const handleCallingCancel = () => {
    socket.emit("callEnded", { to: receiverId });
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setCalling(false);
    setIsCallModalVisible(false);
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Danh sách</h2>
        {/* lấy list user */}
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
        {/* các nút như logout, call video */}
        <div className="top-bar">
          {receiverId && (
            <div
              onClick={() => requestVideoCall({ video: false })}
              className="video-call-btn"
            >
              <IoCall />
              Call
            </div>
          )}
          {receiverId && (
            <div
              onClick={() => requestVideoCall({ video: true })}
              className="video-call-btn"
            >
              <FaVideo />
              Video Call
            </div>
          )}

          {user.role === "admin" && (
            <Link className="admin-link" to="/admin">
              Quản trị
            </Link>
          )}
          <div className="btn-logout" onClick={showConfirm}>
            <CiLogout />
            Logout
          </div>
          {/* nơi hiện đoạn tin và ô input */}
        </div>
        {receiverId ? (
          <>
            <div className="message-list">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${
                    Number(msg.senderId) === Number(user.userId)
                      ? "sent"
                      : "received"
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
      {/* popup cuộc gọi video */}
      <Modal
        title="Cuộc gọi video"
        open={isCallModalVisible}
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

      {/* popup khi đang chờ chấp nhận call video */}
      <Modal
        title="Đang gọi"
        open={calling}
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
