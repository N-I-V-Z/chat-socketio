import { message, Input, Button } from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Register.css";
import Header from "../layout/Header";
const config = require("../config/config");

function Register() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleClear = () => {
    setUserName("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleRegister = async () => {
    if (!userName || !password || !confirmPassword) {
      message.error("Vui lòng nhập đầy đủ thông tin");
    } else if (password !== confirmPassword) {
      message.error("Mật khẩu xác nhận không chính xác");
    } else {
      try {
        await axios.post(`${config.API_ROOT}/api/v1/user/register`, {
          userName,
          password,
        });

        message.success("Đăng kí thành công");
        navigate("/");
      } catch (error) {
        message.error(error.response.data.mes);
      }
    }
  };

  return (
    <div className="register-container">
      <Header />
      <h1 className="register-title">Register</h1>
      <div className="register-field">
        <label>User Name</label>
        <Input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your user name"
        />
      </div>
      <div className="register-field">
        <label>Password</label>
        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />
      </div>
      <div className="register-field">
        <label>Confirm Password</label>
        <Input.Password
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
        />
      </div>
      <div className="register-buttons">
        <Button type="primary" onClick={handleRegister}>
          Register
        </Button>
        <Button onClick={handleClear}>Clear</Button>
      </div>
    </div>
  );
}

export default Register;
