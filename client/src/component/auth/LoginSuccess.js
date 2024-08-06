import { useEffect, useState } from "react";
import { login } from "../store/actions/authAction";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import config from "../config/config";

const LoginSuccess = () => {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const response = await axios.post(
        `${config.API_ROOT}/api/v1/user/getUserByUserId`,
        {
          userId,
        }
      );
      const data = {
        userId: response.data.data.userId,
        userName: response.data.data.userName,
      };      
      setUser(data);
    };
    getUser();
  }, [userId]);
  
  useEffect(() => {
    if (user) {
      dispatch(login(user)); // Dispatch login action with user data
      navigate("/chat", { replace: true }); // Navigate to chat page
    }
  }, [dispatch, navigate, user]);
  return null; // No UI to render
};

export default LoginSuccess;
