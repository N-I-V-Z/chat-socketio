import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Alert,
  Button,
  Card,
  Flex,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import api from "../../api/client";
import "./AdminDashboard.css";

const { Title, Text } = Typography;
const PAGE_SIZE = 25;

const eventLabels = {
  "user.registered": "Đăng ký",
  "auth.login.succeeded": "Đăng nhập thành công",
  "auth.login.failed": "Đăng nhập thất bại",
  "auth.logout": "Đăng xuất",
  "presence.connected": "Online",
  "presence.disconnected": "Offline",
  "message.sent": "Gửi tin nhắn (chỉ metadata)",
  "admin.users.viewed": "Xem danh sách user",
  "admin.audit_logs.viewed": "Xem audit log",
};

const eventOptions = [
  { value: "", label: "Tất cả sự kiện" },
  ...Object.entries(eventLabels).map(([value, label]) => ({ value, label })),
];

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminDashboard() {
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError("");
    try {
      const response = await api.get("/api/v1/admin/users");
      setUsers(response.data.data);
    } catch {
      setError("Không thể tải danh sách người dùng. Vui lòng thử lại.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    setError("");
    try {
      const response = await api.get("/api/v1/admin/logs", {
        params: {
          page,
          pageSize: PAGE_SIZE,
          ...(eventType ? { eventType } : {}),
        },
      });
      setLogs(response.data.data);
    } catch {
      setError("Không thể tải audit log. Vui lòng thử lại.");
    } finally {
      setLoadingLogs(false);
    }
  }, [eventType, page]);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    } else {
      loadLogs();
    }
  }, [activeTab, loadLogs, loadUsers]);

  const userColumns = [
    {
      title: "Tên người dùng",
      dataIndex: "userName",
      key: "userName",
    },
    {
      title: "Quyền",
      dataIndex: "role",
      key: "role",
      render: (role) =>
        role === "admin" ? <Tag color="blue">Admin</Tag> : <Tag>User</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isOnline",
      key: "isOnline",
      render: (isOnline) =>
        isOnline ? (
          <Tag color="green">Đang online</Tag>
        ) : (
          <Tag>Offline</Tag>
        ),
    },
  ];

  const logColumns = [
    {
      title: "Thời gian",
      dataIndex: "occurredAt",
      key: "occurredAt",
      render: formatDate,
    },
    {
      title: "Sự kiện",
      dataIndex: "eventType",
      key: "eventType",
      render: (value) => eventLabels[value] || value,
    },
    {
      title: "Người thực hiện",
      key: "actor",
      render: (_, record) =>
        record.actorUserName || (record.actorUserId ? `ID ${record.actorUserId}` : "Không xác định"),
    },
    {
      title: "User liên quan",
      dataIndex: "targetUserId",
      key: "targetUserId",
      render: (value) => (value ? `ID ${value}` : "—"),
    },
    {
      title: "Kết quả",
      dataIndex: "outcome",
      key: "outcome",
      render: (value) =>
        value === "failure" ? (
          <Tag color="red">Thất bại</Tag>
        ) : value === "success" ? (
          <Tag color="green">Thành công</Tag>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Text className="admin-eyebrow">CHAT / QUẢN TRỊ</Text>
          <Title level={2}>Bảng điều khiển</Title>
          <Text type="secondary">
            Xin chào {user?.userName}. Dữ liệu audit được lưu trong 30 ngày.
          </Text>
        </div>
        <Space>
          <Text type="secondary">Admin</Text>
          <Button type="default">
            <Link to="/chat">Quay lại chat</Link>
          </Button>
        </Space>
      </header>

      <section className="admin-content">
        {error && (
          <Alert
            className="admin-error"
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError("")}
          />
        )}
        <Card className="admin-card">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setError("");
              setActiveTab(key);
            }}
            items={[
              {
                key: "users",
                label: "Người dùng",
                children: (
                  <Table
                    rowKey="userId"
                    columns={userColumns}
                    dataSource={users}
                    loading={loadingUsers}
                    pagination={false}
                    locale={{ emptyText: "Chưa có người dùng." }}
                  />
                ),
              },
              {
                key: "logs",
                label: "Audit log",
                children: (
                  <>
                    <Flex className="admin-log-toolbar" justify="space-between" align="center">
                      <Text type="secondary">
                        {logs.total} sự kiện trong hệ thống
                      </Text>
                      <Select
                        aria-label="Lọc theo sự kiện"
                        value={eventType}
                        options={eventOptions}
                        onChange={(value) => {
                          setPage(1);
                          setEventType(value);
                        }}
                        style={{ width: 240 }}
                      />
                    </Flex>
                    <Table
                      rowKey="eventId"
                      columns={logColumns}
                      dataSource={logs.items}
                      loading={loadingLogs}
                      pagination={{
                        current: page,
                        pageSize: PAGE_SIZE,
                        total: logs.total,
                        showSizeChanger: false,
                        onChange: setPage,
                      }}
                      locale={{ emptyText: "Chưa có audit log." }}
                    />
                  </>
                ),
              },
            ]}
          />
        </Card>
      </section>
    </main>
  );
}

export default AdminDashboard;
