import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import {
  appendConversationMessage,
  appendSocketMessage,
  applyConversationRead,
} from "./utils/chatQueryCache";
import { groupMessagesByDay } from "./utils/messageDateFormat";
import ChatConversation from "./components/ChatConversation";
import ChatSidebar from "./components/ChatSidebar";
import CallDialogs from "./components/CallDialogs";
import useReadReceipts from "./hooks/useReadReceipts";
import { useToast } from "../ui/ToastProvider";

const EMPTY_MESSAGES = [];
const SCROLL_EDGE_PX = 72;
const BOTTOM_THRESHOLD_PX = 96;

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
  const [isMobileConversationOpen, setIsMobileConversationOpen] =
    useState(false);
  const [drafts, setDrafts] = useState({});
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
  const draftKey = String(receiverId);
  const message = drafts[draftKey] || "";
  const hasValidReceiver =
    Number.isSafeInteger(normalizedReceiverId) && normalizedReceiverId > 0;
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const callGenerationRef = useRef(0);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const messageListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const scrollAnchorRef = useRef(null);
  const initialScrollConversationRef = useRef(null);
  const initialScrollCompletedRef = useRef(false);
  const olderFetchInFlightRef = useRef(false);
  const iceCandidateQueueRef = useRef([]);
  const callIdRef = useRef(null);
  const ringTimerRef = useRef(null);
  const incomingTimerRef = useRef(null);

  // Dùng ref để lưu trữ các giá trị thay đổi liên tục nhằm tránh đưa vào dependency array của socket useEffect
  const peerConnectionRef = useRef(peerConnection);
  peerConnectionRef.current = peerConnection;

  const receiverIdRef = useRef(receiverId);
  receiverIdRef.current = receiverId;

  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const stopLocalMedia = useCallback(() => {
    callGenerationRef.current += 1;
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
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
      const response = await api.get("/api/v1/users");
      return response.data.data;
    },
    enabled: hasValidUserId,
  });
  const unreadSummaryQuery = useQuery({
    queryKey: hasValidUserId
      ? queryKeys.unreadSummary(currentUserId)
      : ["conversation-unread", "disabled"],
    queryFn: async () => {
      const response = await api.get("/api/v1/conversations/unread-summary");
      return response.data.data;
    },
    enabled: hasValidUserId,
  });
  const directConversationQueryKey =
    hasValidReceiver && hasValidUserId
      ? queryKeys.directConversation(currentUserId, normalizedReceiverId)
      : ["direct-conversation", "disabled"];
  const directConversationQuery = useQuery({
    queryKey: directConversationQueryKey,
    queryFn: async () => {
      const response = await api.put(
        `/api/v1/conversations/direct/${normalizedReceiverId}`,
      );
      const conversationId = Number(response.data?.data?.conversationId);
      if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
        throw new Error("The direct conversation response is invalid.");
      }
      return { conversationId };
    },
    enabled: hasValidReceiver && hasValidUserId,
  });
  const rawConversationId = directConversationQuery.data?.conversationId;
  const parsedConversationId =
    rawConversationId === undefined ? null : Number(rawConversationId);
  const conversationId =
    Number.isSafeInteger(parsedConversationId) && parsedConversationId > 0
      ? parsedConversationId
      : null;
  const hasValidConversationId = conversationId !== null;
  const conversationQueryKey = hasValidConversationId
    ? queryKeys.conversation(conversationId)
    : ["conversation", "disabled"];
  const messagesQuery = useInfiniteQuery({
    queryKey: conversationQueryKey,
    queryFn: async ({ pageParam }) => {
      const response = await api.get(
        `/api/v1/conversations/${conversationId}/messages`,
        {
          params:
            pageParam === null ? undefined : { beforeMessageId: pageParam },
        },
      );
      return response.data.data;
    },
    enabled: hasValidConversationId && hasValidUserId,
    initialPageParam: null,
    getPreviousPageParam: (firstPage) =>
      firstPage.hasMore ? firstPage.nextCursor : undefined,
    getNextPageParam: () => undefined,
  });
  const {
    data: messagePages,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = messagesQuery;
  const userList = userListQuery.data || [];
  const messages = useMemo(
    () =>
      messagesQuery.data?.pages.flatMap((page) =>
        page.items.map((item) => ({
          MessageId: item.MessageId,
          senderId: Number(item.SenderId),
          message: item.MessageText,
          Timestamp: item.Timestamp ?? null,
          readReceipts: item.readReceipts || [],
        })),
      ) || EMPTY_MESSAGES,
    [messagesQuery.data],
  );
  const unreadCountByPeer = useMemo(
    () =>
      new Map(
        (unreadSummaryQuery.data || []).map(({ peerUserId, unreadCount }) => [
          Number(peerUserId),
          Number(unreadCount),
        ]),
      ),
    [unreadSummaryQuery.data],
  );

  const latestSeenMessageId = useMemo(() => {
    if (!hasValidReceiver || messages.length === 0) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const item = messages[i];
      if (
        Number(item.senderId) === currentUserId &&
        item.readReceipts.some(
          (receipt) => Number(receipt.UserId) === normalizedReceiverId,
        )
      ) {
        return Number(item.MessageId) || 0;
      }
    }
    return null;
  }, [currentUserId, hasValidReceiver, messages, normalizedReceiverId]);

  const messageGroups = useMemo(() => groupMessagesByDay(messages), [messages]);
  const selectedUser = userList.find(
    (listedUser) => Number(listedUser.userId) === normalizedReceiverId,
  );
  const selectedUserName = selectedUser?.userName || "Cuộc trò chuyện";

  const loadOlderMessages = useCallback(() => {
    const container = messageListRef.current;
    if (
      !container ||
      !hasPreviousPage ||
      isFetchingPreviousPage ||
      olderFetchInFlightRef.current
    ) {
      return;
    }

    olderFetchInFlightRef.current = true;
    const pageCount = messagePages?.pages.length || 0;
    scrollAnchorRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };

    fetchPreviousPage()
      .then((result) => {
        if (
          result.isFetchPreviousPageError ||
          (result.data?.pages.length || 0) <= pageCount
        ) {
          scrollAnchorRef.current = null;
        }
      })
      .catch(() => {
        scrollAnchorRef.current = null;
      })
      .finally(() => {
        olderFetchInFlightRef.current = false;
      });
  }, [
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
    messagePages,
  ]);

  const handleMessageListScroll = useCallback(
    (event) => {
      const container = event.currentTarget;
      isNearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        BOTTOM_THRESHOLD_PX;
      if (container.scrollTop <= SCROLL_EDGE_PX) {
        loadOlderMessages();
      }
    },
    [loadOlderMessages],
  );

  useLayoutEffect(() => {
    const container = messageListRef.current;
    if (initialScrollConversationRef.current !== conversationId) {
      initialScrollConversationRef.current = conversationId;
      initialScrollCompletedRef.current = false;
      isNearBottomRef.current = true;
      scrollAnchorRef.current = null;
    }
    if (!container || !hasValidConversationId || !messagesQuery.data) {
      return;
    }

    if (scrollAnchorRef.current) {
      const anchor = scrollAnchorRef.current;
      container.scrollTop =
        anchor.scrollTop + container.scrollHeight - anchor.scrollHeight;
      scrollAnchorRef.current = null;
      isNearBottomRef.current = false;
      return;
    }

    if (!initialScrollCompletedRef.current) {
      container.scrollTop = container.scrollHeight;
      initialScrollCompletedRef.current = true;
      isNearBottomRef.current = true;
      return;
    }

    if (isNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [conversationId, hasValidConversationId, messagesQuery.data]);

  useReadReceipts({
    conversationId,
    currentUserId,
    hasValidConversationId,
    messageListRef,
    queryClient,
    toast,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId: targetId, message: text }) => {
      const response = await api.post(
        `/api/v1/conversations/${targetId}/messages`,
        { message: text },
      );
      return response.data.data;
    },
    onSuccess: (savedMessage, variables) => {
      appendConversationMessage(
        queryClient,
        variables.conversationId,
        savedMessage,
      );
    },
    onError: (_error, variables) => {
      const key = String(variables.receiverId);
      setDrafts((current) => ({
        ...current,
        [key]: current[key]
          ? `${variables.message}\n${current[key]}`
          : variables.message,
      }));
      toast("Tin nhắn chưa được gửi. Vui lòng thử lại.", "error");
    },
  });

  useEffect(() => {
    const handleConnect = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.unreadSummary(currentUserId),
      });
    };
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

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [currentUserId, dispatch, navigate, queryClient, socket, toast]);

  const addIceCandidateSafely = useCallback(async (connection, candidate) => {
    try {
      if (connection.remoteDescription && connection.remoteDescription.type) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (error) {
      console.error("Could not add the ICE candidate", error);
    }
  }, []);

  const flushIceCandidateQueue = useCallback(async (connection) => {
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Could not add queued ICE candidate", error);
      }
    }
  }, []);

  // Khởi tạo RTCPeerConnection dùng chung, tách biệt vai trò tạo offer (Caller) và chờ nhận offer (Callee)
  const initializePeerConnection = useCallback(
    async (video, shouldCreateOffer = false) => {
      const generation = ++callGenerationRef.current;
      setCallHasVideo(Boolean(video));
      iceCandidateQueueRef.current = [];

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            iceCandidate: event.candidate,
            to: receiverIdRef.current,
            callId: callIdRef.current,
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
        if (generation !== callGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          connection.close();
          return null;
        }
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => {
          if (connection.signalingState !== "closed") {
            connection.addTrack(track, stream);
          }
        });

        peerConnectionRef.current = connection;
        setPeerConnection(connection);

        // Chỉ bên chủ động gọi (Caller) mới tạo Offer
        if (shouldCreateOffer) {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          socket.emit("offer", {
            offer,
            to: receiverIdRef.current,
            callId: callIdRef.current,
          });
        }

        return connection;
      } catch (error) {
        connection.close();
        stopLocalMedia();
        peerConnectionRef.current = null;
        setPeerConnection(null);
        setCalling(false);
        setIsCallModalVisible(false);
        toast("Không thể truy cập micro hoặc camera.", "error");
        return null;
      }
    },
    [socket, stopLocalMedia, toast],
  );

  // Bên nhận cuộc gọi (Callee): Mở modal, chuẩn bị media/peerConnection ở trạng thái stable để đón Offer
  const handleAcceptCall = useCallback(
    async (from, video, callId) => {
      callIdRef.current = callId;
      setReceiverId(from);
      receiverIdRef.current = from;
      setIsMobileConversationOpen(true);
      setIsCallModalVisible(true);

      const connection = await initializePeerConnection(video, false);
      if (connection) {
        socket.emit("callAccepted", { to: from, callId }, (reply) => {
          if (reply?.ok) return;
          callIdRef.current = null;
          setIsCallModalVisible(false);
          connection.close();
          stopLocalMedia();
          toast("Cuộc gọi đã hết hạn hoặc không còn khả dụng.", "error");
        });
      }
    },
    [initializePeerConnection, socket, stopLocalMedia, toast],
  );

  // useEffect đăng ký sự kiện socket giờ đây chỉ chạy một lần duy nhất khi mount
  useEffect(() => {
    const handleReceiveMessage = (event) => {
      appendSocketMessage(queryClient, currentUserIdRef.current, event);
      if (Number(event.senderId) !== currentUserIdRef.current) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.unreadSummary(currentUserIdRef.current),
        });
      }
    };
    const handleConversationRead = (event) => {
      applyConversationRead(
        queryClient,
        event.conversationId,
        event.readerId,
        event.upToMessageId,
        event.readAt,
      );
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("conversationRead", handleConversationRead);
    socket.on("videoCallRequest", (request) => {
      clearTimeout(incomingTimerRef.current);
      setIncomingCall(request);
      incomingTimerRef.current = setTimeout(() => setIncomingCall(null), 60000);
    });

    // Khi đối phương bấm chấp nhận cuộc gọi -> Bên gọi (Caller) bắt đầu khởi tạo PeerConnection và gửi Offer
    socket.on("callAccepted", ({ from, video, callId }) => {
      if (callIdRef.current && callIdRef.current !== callId) return;
      clearTimeout(ringTimerRef.current);
      callIdRef.current = callId;
      setReceiverId(from);
      receiverIdRef.current = from;
      setIsMobileConversationOpen(true);
      setCalling(false);
      setIsCallModalVisible(true);
      initializePeerConnection(video, true);
    });

    socket.on("callRejected", ({ callId }) => {
      if (callIdRef.current !== callId) return;
      clearTimeout(ringTimerRef.current);
      callIdRef.current = null;
      toast("Cuộc gọi đã bị từ chối.", "info");
      setCalling(false);
    });

    socket.on("callEnded", ({ callId }) => {
      if (callIdRef.current !== callId) return;
      clearTimeout(ringTimerRef.current);
      clearTimeout(incomingTimerRef.current);
      callIdRef.current = null;
      setIsCallModalVisible(false);
      setCalling(false);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        setPeerConnection(null);
      }
      stopLocalMedia();
      setCallHasVideo(false);
      toast("Cuộc gọi đã kết thúc.", "info");
    });

    socket.on("offer", async ({ offer }) => {
      const activePeerConnection = peerConnectionRef.current;
      if (!activePeerConnection) return;

      try {
        if (activePeerConnection.signalingState === "stable") {
          await activePeerConnection.setRemoteDescription(
            new RTCSessionDescription(offer),
          );

          await flushIceCandidateQueue(activePeerConnection);

          const answer = await activePeerConnection.createAnswer();
          await activePeerConnection.setLocalDescription(answer);
          socket.emit("answer", {
            answer,
            to: receiverIdRef.current,
            callId: callIdRef.current,
          });
        } else {
          console.warn(
            "Bỏ qua offer vì peer connection không ở trạng thái stable:",
            activePeerConnection.signalingState,
          );
        }
      } catch (error) {
        console.error("Could not accept the call offer", error);
        toast("Không thể thiết lập cuộc gọi.", "error");
      }
    });

    socket.on("answer", async ({ answer }) => {
      const activePeerConnection = peerConnectionRef.current;
      if (!activePeerConnection) return;

      try {
        if (activePeerConnection.signalingState === "have-local-offer") {
          await activePeerConnection.setRemoteDescription(
            new RTCSessionDescription(answer),
          );

          await flushIceCandidateQueue(activePeerConnection);
        } else {
          console.warn(
            "Bỏ qua answer vì peer connection đang ở trạng thái:",
            activePeerConnection.signalingState,
          );
        }
      } catch (error) {
        console.error("Could not apply the call answer", error);
        toast("Không thể thiết lập cuộc gọi.", "error");
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      const activePeerConnection = peerConnectionRef.current;
      if (!activePeerConnection || !candidate.iceCandidate) return;
      await addIceCandidateSafely(activePeerConnection, candidate.iceCandidate);
    });

    return () => {
      clearTimeout(ringTimerRef.current);
      clearTimeout(incomingTimerRef.current);
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      stopLocalMedia();
      socket.off("receiveMessage");
      socket.off("conversationRead");
      socket.off("videoCallRequest");
      socket.off("callAccepted");
      socket.off("callRejected");
      socket.off("callEnded");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [
    addIceCandidateSafely,
    flushIceCandidateQueue,
    initializePeerConnection,
    queryClient,
    socket,
    stopLocalMedia,
    toast,
  ]);

  useEffect(() => {
    if (!isCallModalVisible) return undefined;
    const timer = setInterval(() => {
      if (!callIdRef.current) return;
      socket.emit("callHeartbeat", { callId: callIdRef.current }, (reply) => {
        if (reply?.ok) return;
        callIdRef.current = null;
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        setPeerConnection(null);
        stopLocalMedia();
        setIsCallModalVisible(false);
        toast("Kết nối cuộc gọi đã kết thúc.", "error");
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [isCallModalVisible, socket, stopLocalMedia, toast]);

  const sendMessage = () => {
    const text = message.trim();
    if (
      text &&
      hasValidReceiver &&
      hasValidConversationId &&
      !sendMessageMutation.isPending
    ) {
      sendMessageMutation.mutate({
        receiverId: normalizedReceiverId,
        conversationId,
        message: text,
      });
      setDrafts((current) => ({ ...current, [draftKey]: "" }));
    }
  };

  const handleMessageKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const requestCall = (video) => {
    clearTimeout(ringTimerRef.current);
    ringTimerRef.current = setTimeout(() => {
      if (callIdRef.current)
        socket.emit("callEnded", { to: receiverId, callId: callIdRef.current });
      callIdRef.current = null;
      setCalling(false);
      toast("Không có phản hồi từ người nhận.", "info");
    }, 60000);
    socket.emit(
      "videoCallRequest",
      {
        to: receiverId,
        video,
      },
      (result) => {
        if (result?.ok) callIdRef.current = result.callId;
        else {
          clearTimeout(ringTimerRef.current);
          setCalling(false);
          toast("Không thể bắt đầu cuộc gọi.", "error");
        }
      },
    );
    setCalling(true);
  };

  const handleCallCancel = () => {
    clearTimeout(ringTimerRef.current);
    setIsCallModalVisible(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setPeerConnection(null);
    }
    stopLocalMedia();
    setCallHasVideo(false);
    if (callIdRef.current)
      socket.emit("callEnded", { to: receiverId, callId: callIdRef.current });
    callIdRef.current = null;
  };

  const handleCallingCancel = () => {
    clearTimeout(ringTimerRef.current);
    if (callIdRef.current)
      socket.emit("callEnded", { to: receiverId, callId: callIdRef.current });
    callIdRef.current = null;
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setPeerConnection(null);
    }
    stopLocalMedia();
    setCalling(false);
    setIsCallModalVisible(false);
    setCallHasVideo(false);
  };

  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    clearTimeout(incomingTimerRef.current);
    handleAcceptCall(
      incomingCall.from,
      incomingCall.video,
      incomingCall.callId,
    );
    setIncomingCall(null);
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      clearTimeout(incomingTimerRef.current);
      socket.emit("callRejected", {
        to: incomingCall.from,
        callId: incomingCall.callId,
      });
      setIncomingCall(null);
    }
  };

  return (
    <main className="h-full min-h-0 bg-canvas text-ink">
      <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-cols-1 grid-rows-1 gap-0 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-4 lg:p-5">
        <ChatSidebar
          isMobileConversationOpen={isMobileConversationOpen}
          onSelectUser={(userId) => {
            setReceiverId(userId);
            setIsMobileConversationOpen(true);
          }}
          unreadCountByPeer={unreadCountByPeer}
          unreadSummaryQuery={unreadSummaryQuery}
          user={user}
          userList={userList}
          userListQuery={userListQuery}
          selectedUserId={normalizedReceiverId}
        />

        <ChatConversation
          currentUserId={currentUserId}
          directConversationQuery={directConversationQuery}
          hasValidConversationId={hasValidConversationId}
          hasValidReceiver={hasValidReceiver}
          isMobileConversationOpen={isMobileConversationOpen}
          latestSeenMessageId={latestSeenMessageId}
          loadOlderMessages={loadOlderMessages}
          message={message}
          messageGroups={messageGroups}
          messageListRef={messageListRef}
          messages={messages}
          messagesQuery={messagesQuery}
          onBack={() => setIsMobileConversationOpen(false)}
          onMessageChange={(event) =>
            setDrafts((current) => ({
              ...current,
              [draftKey]: event.target.value,
            }))
          }
          onMessageKeyDown={handleMessageKeyDown}
          onMessageListScroll={handleMessageListScroll}
          onRequestCall={requestCall}
          onSendMessage={sendMessage}
          selectedUser={selectedUser}
          selectedUserName={selectedUserName}
          sendMessageMutation={sendMessageMutation}
        />
      </div>

      <CallDialogs
        acceptIncomingCall={acceptIncomingCall}
        callHasVideo={callHasVideo}
        calling={calling}
        handleCallCancel={handleCallCancel}
        handleCallingCancel={handleCallingCancel}
        incomingCall={incomingCall}
        isCallModalVisible={isCallModalVisible}
        localVideoRef={localVideoRef}
        rejectIncomingCall={rejectIncomingCall}
        remoteAudioRef={remoteAudioRef}
        remoteVideoRef={remoteVideoRef}
        selectedUserName={selectedUserName}
      />
    </main>
  );
};

export default Chat;
