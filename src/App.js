import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./component/auth/Login";
import Register from "./component/auth/Register";
import Chat from "./component/chat/Chat";
import LoginSuccess from "./component/auth/LoginSuccess";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/login-success/:userId" element={<LoginSuccess />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
