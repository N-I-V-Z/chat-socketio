import React, {
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
} from "./chatQueryCache";
import {
  formatMessageTime,
  groupMessagesByDay,
  toValidDate,
} from "./messageDateFormat";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import { useToast } from "../ui/ToastProvider";
import { FaVideo } from "react-icons/fa6";
import { IoArrowBack, IoCall } from "react-icons/io5";
import { cn } from "../ui/cn";

const EMPTY_MESSAGES = [];
const SCROLL_EDGE_PX = 72;
const BOTTOM_THRESHOLD_PX = 96;
const READ_RECEIPT_DEBOUNCE_MS = 200;
const READ_INTERSECTION_THRESHOLD = 0.6;

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
  const messageListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const scrollAnchorRef = useRef(null);
  const initialScrollConversationRef = useRef(null);
  const initialScrollCompletedRef = useRef(false);
  const olderFetchInFlightRef = useRef(false);
  const pendingReadMessageIdRef = useRef(0);
  const requestedReadMessageIdRef = useRef(0);
  const acknowledgedReadMessageIdRef = useRef(0);
  const readReceiptTimerRef = useRef(null);
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
    if (!hasValidReceiver) return null;
    return (
      messages.reduce((latestId, item) => {
        if (
          Number(item.senderId) !== currentUserId ||
          !item.readReceipts.some(
            (receipt) => Number(receipt.UserId) === normalizedReceiverId,
          )
        ) {
          return latestId;
        }
        return Math.max(latestId, Number(item.MessageId) || 0);
      }, 0) || null
    );
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

  useEffect(() => {
    pendingReadMessageIdRef.current = 0;
    requestedReadMessageIdRef.current = 0;
    acknowledgedReadMessageIdRef.current = 0;
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
      readReceiptTimerRef.current = null;
    }

    return () => {
      if (readReceiptTimerRef.current) {
        clearTimeout(readReceiptTimerRef.current);
        readReceiptTimerRef.current = null;
      }
    };
  }, [conversationId]);

  const markReadMutation = useMutation({
    mutationFn: async ({ targetConversationId, upToMessageId }) => {
      const response = await api.put(
        `/api/v1/conversations/${targetConversationId}/read-receipt`,
        { upToMessageId },
      );
      return response.data.data;
    },
    retry: 1,
    onSuccess: (readState, variables) => {
      acknowledgedReadMessageIdRef.current = Math.max(
        acknowledgedReadMessageIdRef.current,
        Number(readState.upToMessageId),
      );
      applyConversationRead(
        queryClient,
        variables.targetConversationId,
        currentUserId,
        readState.upToMessageId,
        readState.readAt,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.unreadSummary(currentUserId),
      });
    },
    onError: (_error, variables) => {
      requestedReadMessageIdRef.current = acknowledgedReadMessageIdRef.current;
      pendingReadMessageIdRef.current = Math.max(
        pendingReadMessageIdRef.current,
        variables.upToMessageId,
      );
      toast("Không thể cập nhật trạng thái đã đọc.", "error");
    },
  });

  const queueReadReceipt = useCallback(
    (messageId) => {
      const parsedMessageId = Number(messageId);
      if (
        !hasValidConversationId ||
        !Number.isSafeInteger(parsedMessageId) ||
        parsedMessageId < 1 ||
        parsedMessageId <=
          Math.max(
            requestedReadMessageIdRef.current,
            pendingReadMessageIdRef.current,
          )
      ) {
        return;
      }

      pendingReadMessageIdRef.current = parsedMessageId;
      if (readReceiptTimerRef.current) return;

      readReceiptTimerRef.current = setTimeout(() => {
        readReceiptTimerRef.current = null;
        const upToMessageId = pendingReadMessageIdRef.current;
        pendingReadMessageIdRef.current = 0;
        if (upToMessageId <= requestedReadMessageIdRef.current) return;

        requestedReadMessageIdRef.current = upToMessageId;
        markReadMutation.mutate({
          targetConversationId: conversationId,
          upToMessageId,
        });
      }, READ_RECEIPT_DEBOUNCE_MS);
    },
    [conversationId, hasValidConversationId, markReadMutation.mutate],
  );

  useEffect(() => {
    const container = messageListRef.current;
    if (!container || !messagesQuery.data) return undefined;

    const messageElements = container.querySelectorAll(
      "[data-chat-message][data-message-id]",
    );
    if (typeof IntersectionObserver === "undefined") {
      const markVisibleMessages = () => {
        const containerBounds = container.getBoundingClientRect();
        let highestVisibleMessageId = 0;
        messageElements.forEach((element) => {
          const bounds = element.getBoundingClientRect();
          const visibleHeight =
            Math.min(bounds.bottom, containerBounds.bottom) -
            Math.max(bounds.top, containerBounds.top);
          if (
            visibleHeight > 0 &&
            visibleHeight / Math.max(bounds.height, 1) >=
              READ_INTERSECTION_THRESHOLD
          ) {
            highestVisibleMessageId = Math.max(
              highestVisibleMessageId,
              Number(element.dataset.messageId) || 0,
            );
          }
        });
        if (highestVisibleMessageId > 0) {
          queueReadReceipt(highestVisibleMessageId);
        }
      };

      markVisibleMessages();
      container.addEventListener("scroll", markVisibleMessages);
      return () => container.removeEventListener("scroll", markVisibleMessages);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const highestVisibleMessageId = entries.reduce(
          (highestId, entry) =>
            entry.isIntersecting &&
            entry.intersectionRatio >= READ_INTERSECTION_THRESHOLD
              ? Math.max(highestId, Number(entry.target.dataset.messageId) || 0)
              : highestId,
          0,
        );
        if (highestVisibleMessageId > 0) {
          queueReadReceipt(highestVisibleMessageId);
        }
      },
      {
        root: container,
        threshold: [0, READ_INTERSECTION_THRESHOLD],
      },
    );
    messageElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [conversationId, messagesQuery.data, queueReadReceipt]);

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
      setMessage((currentMessage) => currentMessage || variables.message);
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
      setIsMobileConversationOpen(true);
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
    const handleReceiveMessage = (event) => {
      appendSocketMessage(queryClient, currentUserId, event);
      if (Number(event.senderId) !== currentUserId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.unreadSummary(currentUserId),
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
    socket.on("videoCallRequest", (request) => setIncomingCall(request));
    socket.on("callAccepted", ({ from, video }) => {
      setReceiverId(from);
      setIsMobileConversationOpen(true);
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
    currentUserId,
    peerConnection,
    queryClient,
    receiverId,
    socket,
    stopLocalMedia,
    startCall,
    toast,
  ]);

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
    <main className="h-full min-h-0 bg-canvas text-ink">
      <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-cols-1 grid-rows-1 gap-0 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-4 lg:p-5">
        <aside
          aria-label="Danh sách liên hệ"
          className={cn(
            "min-h-0 flex-col overflow-hidden border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel",
            isMobileConversationOpen ? "hidden lg:flex" : "flex",
          )}
        >
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
              const unreadCount =
                unreadCountByPeer.get(Number(listedUser.userId)) || 0;
              return (
                <li key={listedUser.userId}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => {
                      setReceiverId(listedUser.userId);
                      setIsMobileConversationOpen(true);
                    }}
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
                    {unreadCount > 0 && (
                      <span
                        aria-label={`${unreadCount} tin nhắn chưa đọc`}
                        className="ml-auto grid min-w-6 place-items-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold tabular-nums text-accent-foreground"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {unreadSummaryQuery.isError && (
              <li className="px-2 py-3 text-sm text-danger" role="alert">
                <p>Không thể tải số tin nhắn chưa đọc.</p>
                <button
                  type="button"
                  onClick={() => unreadSummaryQuery.refetch()}
                  className="mt-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Thử lại
                </button>
              </li>
            )}
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
          className={cn(
            "min-h-0 min-w-0 flex-col overflow-hidden border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel",
            isMobileConversationOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <header className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                variant="quiet"
                aria-label="Quay lại danh sách liên hệ"
                onClick={() => setIsMobileConversationOpen(false)}
                className="size-10 min-h-10 shrink-0 rounded-lg px-2 lg:hidden"
              >
                <IoArrowBack aria-hidden="true" className="size-5" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-base font-bold">
                  {selectedUserName}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {selectedUser
                    ? `Trò chuyện với ${selectedUser.userName}`
                    : "Chọn một người dùng để bắt đầu"}
                </p>
              </div>
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
              {(directConversationQuery.isError ||
                (messagesQuery.isError && !messagesQuery.data)) && (
                <div
                  className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger sm:px-6"
                  role="alert"
                >
                  <span>
                    {directConversationQuery.isError
                      ? "Không thể mở cuộc trò chuyện."
                      : "Không thể tải tin nhắn."}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      directConversationQuery.isError
                        ? directConversationQuery.refetch()
                        : messagesQuery.refetch()
                    }
                    className="shrink-0 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                  >
                    Thử lại
                  </button>
                </div>
              )}
              <div
                ref={messageListRef}
                onScroll={handleMessageListScroll}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7"
                role="log"
                aria-label={`Tin nhắn với ${selectedUserName}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                {messagesQuery.isFetchingPreviousPage && (
                  <div
                    className="py-2 text-center text-xs text-muted"
                    role="status"
                  >
                    Đang tải tin nhắn cũ hơn...
                  </div>
                )}
                {messagesQuery.isFetchPreviousPageError && (
                  <div
                    className="flex items-center justify-center gap-2 py-2 text-sm text-danger"
                    role="alert"
                  >
                    <span>Không thể tải tin nhắn cũ hơn.</span>
                    <button
                      type="button"
                      onClick={loadOlderMessages}
                      className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                    >
                      Thử lại
                    </button>
                  </div>
                )}
                {(directConversationQuery.isPending ||
                  (directConversationQuery.isSuccess &&
                    messagesQuery.isPending)) && (
                  <div className="space-y-3" role="status">
                    <span className="block h-10 w-2/3 animate-pulse rounded-2xl bg-surface-muted motion-reduce:animate-none" />
                    <span className="ml-auto block h-10 w-1/2 animate-pulse rounded-2xl bg-accent/10 motion-reduce:animate-none" />
                    <span className="sr-only">Đang tải tin nhắn</span>
                  </div>
                )}
                {!messagesQuery.isPending &&
                  directConversationQuery.isSuccess &&
                  messages.length === 0 && (
                    <div className="grid min-h-full place-items-center py-10 text-center">
                      <div className="max-w-sm">
                        <p className="text-base font-bold">Chưa có tin nhắn</p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          Gửi lời chào đầu tiên để bắt đầu cuộc trò chuyện.
                        </p>
                      </div>
                    </div>
                  )}
                {messageGroups.map((group) => (
                  <React.Fragment key={group.key}>
                    <div
                      className="flex items-center justify-center py-2"
                      role="separator"
                      aria-label={group.label}
                      data-message-day
                    >
                      <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
                        {group.label}
                      </span>
                    </div>
                    {group.messages.map((msg, index) => {
                      const isSent = Number(msg.senderId) === currentUserId;
                      const date = toValidDate(msg.Timestamp);
                      const time = formatMessageTime(msg.Timestamp);
                      const isLatestSeen =
                        isSent && Number(msg.MessageId) === latestSeenMessageId;

                      return (
                        <div
                          key={msg.MessageId ?? `${msg.senderId}-${index}`}
                          data-chat-message
                          data-message-id={msg.MessageId}
                          className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                        >
                          <div className="flex max-w-[85%] flex-col sm:max-w-[70%]">
                            <p
                              className={[
                                "whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6",
                                isSent
                                  ? "rounded-br-md bg-accent text-accent-foreground"
                                  : "rounded-bl-md bg-surface-muted text-ink",
                              ].join(" ")}
                            >
                              {msg.message}
                            </p>
                            {(time || isLatestSeen) && (
                              <div
                                className={`mt-1 flex items-center gap-2 text-xs tabular-nums text-muted ${isSent ? "justify-end" : "justify-start"}`}
                              >
                                {time && date && (
                                  <time dateTime={date.toISOString()}>
                                    {time}
                                  </time>
                                )}
                                {isLatestSeen && <span>Đã xem</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
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
                    className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    type="submit"
                    disabled={
                      sendMessageMutation.isPending ||
                      !message.trim() ||
                      !hasValidConversationId
                    }
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
