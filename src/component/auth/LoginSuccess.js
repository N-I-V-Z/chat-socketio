import { useEffect } from "react";
import { login } from "../store/actions/authAction";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

const LoginSuccess = () => {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      dispatch(login(userId)); // Dispatch login action with user data
      navigate("/chat", { replace: true }); // Navigate to chat page
    }
  }, [userId, dispatch, navigate]);

  return null; // No UI to render
};

export default LoginSuccess;
