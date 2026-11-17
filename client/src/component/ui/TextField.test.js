import { render, screen } from "@testing-library/react";
import TextField from "./TextField";

test("connects the visible label, hint, and validation message to its input", () => {
  render(
    <TextField
      id="user-name"
      label="Tên người dùng"
      hint="Tên hiển thị trong ứng dụng."
      error="Vui lòng nhập tên người dùng."
      required
    />,
  );

  const input = screen.getByLabelText(/Tên người dùng/);

  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe(
    "user-name-hint user-name-error",
  );
  expect(screen.getByRole("alert").textContent).toBe(
    "Vui lòng nhập tên người dùng.",
  );
});
