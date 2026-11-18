import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CallDialogs from "./CallDialogs";

jest.mock("../../../shared/ui/Dialog", () => ({
  __esModule: true,
  default: ({ open, title, className, children, footer }) =>
    open ? (
      <section role="dialog" aria-label={title} data-dialog-class={className}>
        {children}
        {footer}
      </section>
    ) : null,
}));

test("uses a large remote stage and expands the same local video element", () => {
  const props = {
    acceptIncomingCall: jest.fn(),
    callHasVideo: true,
    calling: false,
    handleCallCancel: jest.fn(),
    handleCallingCancel: jest.fn(),
    incomingCall: null,
    isCallModalVisible: true,
    localVideoRef: React.createRef(),
    rejectIncomingCall: jest.fn(),
    remoteAudioRef: React.createRef(),
    remoteVideoRef: React.createRef(),
    selectedUserName: "Lan",
  };
  const view = render(<CallDialogs {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Cuộc gọi video" });
  const localVideo = screen.getByLabelText("Hình ảnh camera của bạn");
  const remoteVideo = screen.getByLabelText("Hình ảnh camera của Lan");

  expect(dialog).toHaveAttribute(
    "data-dialog-class",
    expect.stringContaining("max-w-6xl"),
  );
  expect(remoteVideo.parentElement).toHaveAttribute("data-video-size", "main");
  expect(localVideo.parentElement).toHaveAttribute("data-video-size", "inset");

  fireEvent.click(
    screen.getByRole("button", { name: "Phóng to camera của bạn" }),
  );
  expect(localVideo.parentElement).toHaveAttribute("data-video-size", "main");
  expect(remoteVideo.parentElement).toHaveAttribute("data-video-size", "inset");
  expect(screen.getByLabelText("Hình ảnh camera của bạn")).toBe(localVideo);
  expect(screen.getByLabelText("Hình ảnh camera của Lan")).toBe(remoteVideo);

  fireEvent.click(
    screen.getByRole("button", { name: "Thu nhỏ camera của bạn" }),
  );
  expect(localVideo.parentElement).toHaveAttribute("data-video-size", "inset");

  fireEvent.click(
    screen.getByRole("button", { name: "Phóng to camera của bạn" }),
  );
  view.rerender(<CallDialogs {...props} isCallModalVisible={false} />);
  view.rerender(<CallDialogs {...props} />);
  expect(
    screen.getByRole("button", { name: "Phóng to camera của bạn" }),
  ).toHaveAttribute("aria-pressed", "false");
});
