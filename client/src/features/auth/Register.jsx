import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../shared/api/client";
import AuthLayout from "./AuthLayout";
import Button from "../../shared/ui/Button";
import TextField from "../../shared/ui/TextField";
import { useToast } from "../../shared/ui/ToastProvider";
import { IoArrowForwardOutline } from "react-icons/io5";

function Register() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleClear = () => {
    setUserName("");
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setFormError("");
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!userName.trim()) errors.userName = "Nhập tên người dùng.";
    if (!password) errors.password = "Nhập mật khẩu.";
    if (!confirmPassword) errors.confirmPassword = "Nhập lại mật khẩu.";
    else if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
    }
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await api.post("/api/v1/auth/register", {
        userName: userName.trim(),
        password,
      });
      toast("Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục.", "success");
      navigate("/");
    } catch (error) {
      setFormError(
        error.response?.data?.error?.message ||
          "Không thể tạo tài khoản lúc này. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Bắt đầu trò chuyện"
      title="Tạo tài khoản"
      description="Tạo tài khoản mới để kết nối với mọi người."
    >
      <form
        aria-label="Tạo tài khoản"
        className="grid gap-5 animate-fade-up"
        onSubmit={handleRegister}
        aria-busy={isSubmitting}
        noValidate
      >
        <TextField
          id="register-user-name"
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
          id="register-password"
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: "" }));
          }}
          error={fieldErrors.password}
        />
        <TextField
          id="register-confirm-password"
          label="Xác nhận mật khẩu"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFieldErrors((current) => ({
              ...current,
              confirmPassword: "",
            }));
          }}
          error={fieldErrors.confirmPassword}
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
            <span>
              {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
            </span>
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
        Đã có tài khoản?{" "}
        <Link
          to="/"
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
