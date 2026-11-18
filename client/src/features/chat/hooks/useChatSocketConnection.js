import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  clearAccessToken,
  refreshAccessToken,
} from "../../../shared/api/client";
import { queryKeys } from "../../../shared/api/queryKeys";
import { logout } from "../../auth/store/actions/authAction";

function useChatSocketConnection({
  socket,
  currentUserId,
  queryClient,
  toast,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    let active = true;
    const handleConnect = () => {
      setIsConnected(true);
      queryClient.invalidateQueries({
        queryKey: queryKeys.unreadSummary(currentUserId),
      });
    };
    const handleExpiredConnection = async () => {
      try {
        await refreshAccessToken();
        if (active) socket.connect();
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401) {
          clearAccessToken();
          queryClient.clear();
          dispatch(logout());
          navigate("/", { replace: true });
          return;
        }
        toast("Không thể gia hạn phiên đăng nhập. Vui lòng thử lại.", "error");
      }
    };
    const handleConnectError = (error) => {
      setIsConnected(false);
      if (error.data?.code === "ACCESS_TOKEN_EXPIRED") {
        handleExpiredConnection();
      }
    };
    const handleDisconnect = (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        handleExpiredConnection();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.connect();

    return () => {
      active = false;
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [currentUserId, dispatch, navigate, queryClient, socket, toast]);

  return isConnected;
}

export default useChatSocketConnection;
