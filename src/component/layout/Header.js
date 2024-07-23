import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "antd";
import "./Header.css";

function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="header-container">
      <Menu mode="horizontal" className="header-menu" selectedKeys={[currentPath]}>
        <Menu.Item key="/">
          <Link to="/">Login</Link>
        </Menu.Item>
        <Menu.Item key="/register">
          <Link to="/register">Register</Link>
        </Menu.Item>
      </Menu>
    </div>
  );
}

export default Header;
