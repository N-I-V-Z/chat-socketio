import { message, Input, Button } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Login.css";
import Header from "../layout/Header";
const config = require("../config/config");

function Login() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleClear = () => {
    setUserName("");
    setPassword("");
  };

  const handleLogin = async () => {
    if (!userName || !password) {
      message.error("Vui lòng nhập đầy đủ thông tin");
    } else {
      try {
        const response = await axios.post(
          `${config.API_ROOT}/api/v1/user/login`,
          {
            userName,
            password,
          }
        );
        const userId = response.data.data.userId;
        navigate(`/login-success/${userId}`);
      } catch (error) {
        if (error.response.status === 404)
          message.error("Sai tài khoản hoặc mật khẩu");
        else message.error("Có lỗi xảy ra vui lòng thử lại sau...");
      }
    }
  };

  return (
    <div className="login-container">
      <Header />
      <h1 className="login-title">Login</h1>
      <div className="login-field">
        <label>User Name</label>
        <Input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your user name"
        />
      </div>
      <div className="login-field">
        <label>Password</label>
        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />
      </div>
      <div className="login-buttons">
        <Button type="primary" onClick={handleLogin}>
          Login
        </Button>
        <Button onClick={handleClear}>Clear</Button>
      </div>
    </div>
  );
}

export default Login;
