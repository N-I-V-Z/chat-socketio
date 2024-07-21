import React from "react";
import { Link } from "react-router-dom";
import { Menu } from "antd";
import "./Header.css";

function Header() {
  return (
    <div className="header-container">
      <Menu mode="horizontal" className="header-menu">
        <Menu.Item key="login">
          <Link to="/">Login</Link>
        </Menu.Item>
        <Menu.Item key="register">
          <Link to="/register">Register</Link>
        </Menu.Item>
      </Menu>
    </div>
  );
}

export default Header;
