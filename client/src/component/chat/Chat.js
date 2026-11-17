import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import config from "../config/config";
import api, {
  clearAccessToken,
  getAccessToken,
  refreshAccessToken,
} from "../../api/client";
import { logout } from "../store/actions/authAction";
import { queryKeys } from "../../api/queryKeys";
import { appendSocketMessage, appendUniqueMessage } from "./chatQueryCache";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import { useToast } from "../ui/ToastProvider";
import { FaVideo } from "react-icons/fa6";
import { IoCall } from "react-icons/io5";

const EMPTY_MESSAGES = [];

const Chat = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const socket = useMemo(
    () =>
      io(config.API_ROOT, {
        autoConnect: false,
        auth: (callback) => callback({ token: getAccessToken() }),
      }),
    [],
  );
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [peerConnection, setPeerConnection] = useState(null);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callHasVideo, setCallHasVideo] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const currentUserId = Number(user?.userId);
  const hasValidUserId =
    Number.isSafeInteger(currentUserId) && currentUserId > 0;
  const normalizedReceiverId = receiverId ? Number(receiverId) : null;
  const hasValidReceiver =
    Number.isSafeInteger(normalizedReceiverId) && normalizedReceiverId > 0;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const messageListEndRef = useRef(null);
  const stopLocalMedia = useCallback(() => {
    const stream = localVideoRef.current?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const userListQuery = useQuery({
    queryKey: hasValidUserId
      ? queryKeys.chatUsers(currentUserId)
      : ["chat-users", "disabled"],
    queryFn: async () => {
      const response = await api.post("/api/v1/user/getAll");
      return response.data.data;
    },
    enabled: hasValidUserId,
  });
  const conversationQueryKey =
    hasValidReceiver && hasValidUserId
      ? queryKeys.conversation(currentUserId, normalizedReceiverId)
      : ["conversation", "disabled"];
  const messagesQuery = useQuery({
    queryKey: conversationQueryKey,
    queryFn: async () => {
      const response = await api.post("/api/v1/message/getAllMessageOfRoom", {
        receiverId: normalizedReceiverId,
      });
      return response.data.data.map((item) => ({
        MessageId: item.MessageId,
        senderId: Number(item.SenderId),
        message: item.MessageText,
      }));
    },
    enabled: hasValidReceiver && hasValidUserId,
  });
  const userList = userListQuery.data || [];
  const messages = messagesQuery.data || EMPTY_MESSAGES;
  const selectedUser = userList.find(
    (listedUser) => Number(listedUser.userId) === normalizedReceiverId,
  );
  const selectedUserName = selectedUser?.userName || "Cuộc trò chuyện";

  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId: targetId, message: text }) => {
      const response = await api.post("/api/v1/message/addMessage", {
        receiverId: targetId,
        message: text,
      });
      return response.data.data;
    },
    onSuccess: (savedMessage, variables) => {
      const queryKey = queryKeys.conversation(
        currentUserId,
        variables.receiverId,
      );
      queryClient.setQueryData(queryKey, (cachedMessages) => {
        if (!Array.isArray(cachedMessages)) {
          return cachedMessages;
        }
        return appendUniqueMessage(cachedMessages, {
          MessageId: savedMessage.MessageId,
          senderId: currentUserId,
          message: variables.message,
        });
      });
      socket.emit("sendMessage", {
        receiverId: variables.receiverId,
        message: variables.message,
        messageId: savedMessage.MessageId,
      });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (_error, variables) => {
      setMessage((currentMessage) => currentMessage || variables.message);
      toast("Tin nhắn chưa được gửi. Vui lòng thử lại.", "error");
    },
  });

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
        toast("Không thể gia hạn phiên đăng nhập. Vui lòng thử lại.", "error");
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
  }, [dispatch, navigate, socket, toast]);

  const startCall = useCallback(
    async (video) => {
      setCallHasVideo(Boolean(video));
      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            iceCandidate: event.candidate,
            to: receiverId,
          });
        }
      };

      connection.ontrack = (event) => {
        const mediaElement = video
          ? remoteVideoRef.current
          : remoteAudioRef.current;
        if (mediaElement) {
          mediaElement.srcObject = event.streams[0];
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video ?? false,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => {
          if (connection.signalingState !== "closed") {
            connection.addTrack(track, stream);
          }
        });

        setPeerConnection(connection);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socket.emit("offer", { offer, to: receiverId });
      } catch {
        connection.close();
        stopLocalMedia();
        setPeerConnection(null);
        setCalling(false);
        setIsCallModalVisible(false);
        toast("Không thể truy cập micro hoặc camera.", "error");
      }
    },
    [receiverId, socket, stopLocalMedia, toast],
  );

  const handleAcceptCall = useCallback(
    (from, video) => {
      setReceiverId(from);
      setIsCallModalVisible(true);
      socket.emit("callAccepted", {
        from: user.userId,
        to: from,
        video,
      });
      startCall(video);
    },
    [socket, startCall, user.userId],
  );

  useEffect(() => {
    socket.on("receiveMessage", (event) =>
      appendSocketMessage(queryClient, currentUserId, event),
    );
    socket.on("videoCallRequest", (request) => setIncomingCall(request));
    socket.on("callAccepted", ({ from, video }) => {
      setReceiverId(from);
      setCalling(false);
      startCall(video);
      setIsCallModalVisible(true);
    });
    socket.on("callRejected", () => {
      toast("Cuộc gọi đã bị từ chối.", "info");
      setCalling(false);
    });
    socket.on("callEnded", () => {
      setIsCallModalVisible(false);
      setCalling(false);
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      stopLocalMedia();
      setCallHasVideo(false);
      toast("Cuộc gọi đã kết thúc.", "info");
    });
    socket.on("offer", async ({ offer }) => {
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", { answer, to: receiverId });
      } catch (error) {
        console.error("Could not accept the call offer", error);
        toast("Không thể thiết lập cuộc gọi.", "error");
      }
    });
    socket.on("answer", async ({ answer }) => {
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (error) {
        console.error("Could not apply the call answer", error);
        toast("Không thể thiết lập cuộc gọi.", "error");
      }
    });
    socket.on("ice-candidate", async (candidate) => {
      if (!peerConnection || !candidate.iceCandidate) return;
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate.iceCandidate),
        );
      } catch (error) {
        console.error("Could not add the ICE candidate", error);
        toast("Kết nối cuộc gọi gặp sự cố.", "error");
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
  }, [
    currentUserId,
    peerConnection,
    queryClient,
    receiverId,
    socket,
    stopLocalMedia,
    startCall,
    toast,
  ]);

  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [messages]);

  const sendMessage = () => {
    const text = message.trim();
    if (text && hasValidReceiver && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({
        receiverId: normalizedReceiverId,
        message: text,
      });
      setMessage("");
    }
  };

  const handleMessageKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const requestCall = (video) => {
    socket.emit("videoCallRequest", {
      to: receiverId,
      video,
    });
    setCalling(true);
  };

  const handleCallCancel = () => {
    setIsCallModalVisible(false);
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    stopLocalMedia();
    setCallHasVideo(false);
    socket.emit("callEnded", { to: receiverId });
  };

  const handleCallingCancel = () => {
    socket.emit("callEnded", { to: receiverId });
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    stopLocalMedia();
    setCalling(false);
    setIsCallModalVisible(false);
    setCallHasVideo(false);
  };

  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    handleAcceptCall(incomingCall.from, incomingCall.video);
    setIncomingCall(null);
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      socket.emit("callRejected", { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  return (
    <main className="min-h-full bg-canvas text-ink lg:h-full lg:overflow-hidden">
      <div className="mx-auto grid min-h-dvh max-w-[1600px] grid-rows-[minmax(12rem,30dvh)_minmax(65dvh,1fr)] gap-3 p-3 sm:gap-4 sm:p-5 lg:h-full lg:min-h-0 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Tin nhắn
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight">
                Trò chuyện
              </h1>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-sm font-bold text-accent">
              {user?.userName?.slice(0, 1)?.toLocaleUpperCase() || "?"}
            </span>
          </div>

          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="text-sm font-bold">Người dùng</h2>
            {!userListQuery.isPending && (
              <span className="text-xs text-muted">{userList.length}</span>
            )}
          </div>
          <ul
            aria-label="Danh sách người dùng"
            className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3"
          >
            {userListQuery.isPending && (
              <li className="space-y-2 px-2 py-3" role="status">
                <span className="block h-11 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" />
                <span className="block h-11 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none" />
                <span className="sr-only">Đang tải danh sách người dùng</span>
              </li>
            )}
            {userListQuery.isError && (
              <li className="px-2 py-3 text-sm text-danger" role="alert">
                <p>Không thể tải danh sách người dùng.</p>
                <button
                  type="button"
                  onClick={() => userListQuery.refetch()}
                  className="mt-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Thử lại
                </button>
              </li>
            )}
            {userList.map((listedUser) => {
              const isSelected =
                Number(listedUser.userId) === normalizedReceiverId;
              return (
                <li key={listedUser.userId}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => setReceiverId(listedUser.userId)}
                    className={[
                      "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                      "transition duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isSelected ? "bg-accent/10 text-accent" : "text-ink",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "bg-surface-muted text-muted",
                      ].join(" ")}
                    >
                      {listedUser.userName?.slice(0, 1)?.toLocaleUpperCase() ||
                        "?"}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {listedUser.userName}
                    </span>
                  </button>
                </li>
              );
            })}
            {!userListQuery.isPending &&
              !userListQuery.isError &&
              userList.length === 0 && (
                <li className="px-2 py-3 text-sm text-muted">
                  Chưa có người dùng khác.
                </li>
              )}
          </ul>
        </aside>

        <section
          aria-label="Cuộc trò chuyện"
          className="flex min-h-[65dvh] min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-panel lg:min-h-0"
        >
          <header className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{selectedUserName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {selectedUser
                  ? `Trò chuyện với ${selectedUser.userName}`
                  : "Chọn một người dùng để bắt đầu"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasValidReceiver && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => requestCall(false)}
                    aria-label={`Gọi thoại cho ${selectedUserName}`}
                    className="min-h-10 rounded-lg px-3"
                  >
                    <IoCall aria-hidden="true" />
                    <span className="hidden sm:inline">Gọi thoại</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => requestCall(true)}
                    aria-label={`Gọi video cho ${selectedUserName}`}
                    className="min-h-10 rounded-lg px-3"
                  >
                    <FaVideo aria-hidden="true" />
                    <span className="hidden sm:inline">Gọi video</span>
                  </Button>
                </>
              )}
            </div>
          </header>

          {hasValidReceiver ? (
            <>
              {messagesQuery.isError && (
                <div
                  className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger sm:px-6"
                  role="alert"
                >
                  <span>Không thể tải tin nhắn.</span>
                  <button
                    type="button"
                    onClick={() => messagesQuery.refetch()}
                    className="shrink-0 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                  >
                    Thử lại
                  </button>
                </div>
              )}
              <div
                className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7"
                role="log"
                aria-label={`Tin nhắn với ${selectedUserName}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                {messagesQuery.isPending && (
                  <div className="space-y-3" role="status">
                    <span className="block h-10 w-2/3 animate-pulse rounded-2xl bg-surface-muted motion-reduce:animate-none" />
                    <span className="ml-auto block h-10 w-1/2 animate-pulse rounded-2xl bg-accent/10 motion-reduce:animate-none" />
                    <span className="sr-only">Đang tải tin nhắn</span>
                  </div>
                )}
                {!messagesQuery.isPending && messages.length === 0 && (
                  <div className="grid min-h-full place-items-center py-10 text-center">
                    <div className="max-w-sm">
                      <p className="text-base font-bold">Chưa có tin nhắn</p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Gửi lời chào đầu tiên để bắt đầu cuộc trò chuyện.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((msg, index) => {
                  const isSent = Number(msg.senderId) === currentUserId;
                  return (
                    <div
                      key={msg.MessageId ?? `${msg.senderId}-${index}`}
                      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                    >
                      <p
                        className={[
                          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[70%]",
                          isSent
                            ? "rounded-br-md bg-accent text-accent-foreground"
                            : "rounded-bl-md bg-surface-muted text-ink",
                        ].join(" ")}
                      >
                        {msg.message}
                      </p>
                    </div>
                  );
                })}
                <div ref={messageListEndRef} />
              </div>
              <form
                className="border-t border-line p-3 sm:px-6 sm:py-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <label className="sr-only" htmlFor="chat-message">
                  Tin nhắn mới
                </label>
                <div className="flex items-end gap-2 rounded-2xl border border-line bg-canvas p-2 focus-within:ring-2 focus-within:ring-accent">
                  <textarea
                    id="chat-message"
                    rows={1}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleMessageKeyDown}
                    placeholder="Nhập tin nhắn..."
                    className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={sendMessageMutation.isPending || !message.trim()}
                    className="min-h-10 shrink-0 rounded-xl px-4"
                  >
                    Gửi
                  </Button>
                </div>
                <p className="mt-2 px-2 text-xs text-muted">
                  Nhấn Enter để gửi, Shift + Enter để xuống dòng
                </p>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 py-12 text-center">
              <div className="max-w-sm">
                <p className="text-lg font-bold">
                  Chọn một người để trò chuyện
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Danh sách người dùng đang ở bên trái.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(incomingCall)}
        onOpenChange={(open) => {
          if (!open) rejectIncomingCall();
        }}
        title="Cuộc gọi đến"
        description={`Bạn có muốn nhận cuộc gọi${incomingCall?.video ? " video" : ""} từ ${incomingCall?.name || "người dùng"}?`}
        footer={
          <>
            <Button variant="secondary" onClick={rejectIncomingCall}>
              Từ chối
            </Button>
            <Button onClick={acceptIncomingCall}>Nghe máy</Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          Bạn có thể kết thúc cuộc gọi bất cứ lúc nào.
        </p>
      </Dialog>

      <Dialog
        open={isCallModalVisible}
        onOpenChange={(open) => {
          if (!open) handleCallCancel();
        }}
        title={callHasVideo ? "Cuộc gọi video" : "Cuộc gọi thoại"}
        description={`Đang kết nối với ${selectedUserName}.`}
        className="max-w-3xl"
        footer={
          <Button
            variant="secondary"
            className="text-danger"
            onClick={handleCallCancel}
          >
            Kết thúc cuộc gọi
          </Button>
        }
      >
        {callHasVideo ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                aria-label="Hình ảnh camera của bạn"
                className="aspect-video w-full object-cover"
              />
              <p className="px-3 py-2 text-xs text-white/80">Bạn</p>
            </div>
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                aria-label={`Hình ảnh camera của ${selectedUserName}`}
                className="aspect-video w-full object-cover"
              />
              <p className="px-3 py-2 text-xs text-white/80">
                {selectedUserName}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-xl bg-surface-muted p-6 text-center">
            <audio
              ref={remoteAudioRef}
              autoPlay
              aria-label={`Âm thanh cuộc gọi từ ${selectedUserName}`}
              className="sr-only"
            />
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-xl font-bold text-accent-foreground">
                {selectedUserName.slice(0, 1).toLocaleUpperCase()}
              </span>
              <p className="mt-4 font-semibold">{selectedUserName}</p>
              <p className="mt-1 text-sm text-muted">
                Đang trò chuyện bằng giọng nói
              </p>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={calling}
        onOpenChange={(open) => {
          if (!open) handleCallingCancel();
        }}
        title="Đang gọi"
        description="Đang chờ người nhận trả lời."
        footer={
          <Button variant="secondary" onClick={handleCallingCancel}>
            Hủy cuộc gọi
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
          />
          <p className="text-sm text-muted">
            Cuộc gọi sẽ kết nối khi người nhận chấp thuận.
          </p>
        </div>
      </Dialog>
    </main>
  );
};

export default Chat;
