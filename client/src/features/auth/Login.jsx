import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { IoArrowForwardOutline } from "react-icons/io5";
import api, { setAccessToken } from "../../shared/api/client";
import { login } from "./store/actions/authAction";
import AuthLayout from "./AuthLayout";
import Button from "../../shared/ui/Button";
import TextField from "../../shared/ui/TextField";

function Login() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleClear = () => {
    setUserName("");
    setPassword("");
    setFieldErrors({});
    setFormError("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!userName.trim()) errors.userName = "Nhập tên người dùng.";
    if (!password) errors.password = "Nhập mật khẩu.";
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/api/v1/auth/login", {
        userName: userName.trim(),
        password,
      });
      const { accessToken, user } = response.data.data;
      setAccessToken(accessToken);
      dispatch(login(user));
      navigate("/chat", { replace: true });
    } catch (error) {
      setFormError(
        error.response?.status === 401
          ? "Tên người dùng hoặc mật khẩu không chính xác."
          : error.response?.data?.error?.message ||
              "Không thể đăng nhập lúc này. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập"
      description="Đăng nhập để tiếp tục những cuộc trò chuyện của bạn."
    >
      <form
        aria-label="Đăng nhập"
        className="grid gap-5 animate-fade-up"
        onSubmit={handleLogin}
        aria-busy={isSubmitting}
        noValidate
      >
        <TextField
          id="login-user-name"
          label="Tên người dùng"
          autoComplete="username"
          required
          value={userName}
          onChange={(event) => {
            setUserName(event.target.value);
            setFieldErrors((current) => ({ ...current, userName: "" }));
          }}
          error={fieldErrors.userName}
        />
        <TextField
          id="login-password"
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: "" }));
          }}
          error={fieldErrors.password}
        />
        {formError && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm leading-5 text-danger"
          >
            {formError}
          </p>
        )}
        <div className="grid gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting} className="w-full">
            <span>{isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}</span>
            {!isSubmitting && (
              <IoArrowForwardOutline
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            )}
          </Button>
          <Button
            variant="quiet"
            onClick={handleClear}
            disabled={isSubmitting}
            className="w-full"
          >
            Xóa nội dung
          </Button>
        </div>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          Tạo tài khoản
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
