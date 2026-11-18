import { useEffect, useState } from "react";
import { IoExpandOutline } from "react-icons/io5";
import Button from "../../../shared/ui/Button";
import Dialog from "../../../shared/ui/Dialog";
import { cn } from "../../../shared/ui/cn";

function CallDialogs({
  acceptIncomingCall,
  callHasVideo,
  calling,
  handleCallCancel,
  handleCallingCancel,
  incomingCall,
  isCallModalVisible,
  localVideoRef,
  rejectIncomingCall,
  remoteAudioRef,
  remoteVideoRef,
  selectedUserName,
}) {
  const [localExpanded, setLocalExpanded] = useState(false);

  useEffect(() => {
    if (!isCallModalVisible) setLocalExpanded(false);
  }, [isCallModalVisible]);

  return (
    <>
      <Dialog
        open={Boolean(incomingCall)}
        onOpenChange={(open) => {
          if (!open) rejectIncomingCall();
        }}
        title="Cuộc gọi đến"
        description={`Bạn có muốn nhận cuộc gọi${incomingCall?.video ? " video" : ""} từ ${incomingCall?.name || "người dùng"}?`}
        footer={
          <>
            <Button variant="secondary" onClick={rejectIncomingCall}>
              Từ chối
            </Button>
            <Button onClick={acceptIncomingCall}>Nghe máy</Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">
          Bạn có thể kết thúc cuộc gọi bất cứ lúc nào.
        </p>
      </Dialog>

      <Dialog
        open={isCallModalVisible}
        onOpenChange={(open) => {
          if (!open) handleCallCancel();
        }}
        title={callHasVideo ? "Cuộc gọi video" : "Cuộc gọi thoại"}
        description={
          callHasVideo
            ? `Đang gọi cho ${selectedUserName}. Chạm vào camera của bạn để đổi kích thước.`
            : `Đang kết nối với ${selectedUserName}.`
        }
        className={
          callHasVideo
            ? "w-[calc(100%-1rem)] max-w-6xl max-h-[calc(100dvh-1rem)] p-4 sm:w-[calc(100%-2rem)] sm:p-6"
            : "max-w-xl"
        }
        footer={
          <Button
            variant="secondary"
            className="text-danger"
            onClick={handleCallCancel}
          >
            Kết thúc cuộc gọi
          </Button>
        }
      >
        {callHasVideo ? (
          <div
            role="group"
            aria-label="Video cuộc gọi"
            className="relative h-[min(56dvh,34rem)] min-h-64 overflow-hidden rounded-panel bg-slate-950 sm:h-[min(64dvh,42rem)]"
          >
            <div
              data-video-size={localExpanded ? "inset" : "main"}
              className={cn(
                "absolute overflow-hidden bg-slate-950 transition-[top,right,width,height,border-radius] duration-300 ease-premium motion-reduce:transition-none",
                localExpanded
                  ? "right-3 top-3 z-20 h-28 w-24 rounded-xl border border-white/25 shadow-float sm:right-5 sm:top-5 sm:h-36 sm:w-56"
                  : "right-0 top-0 z-0 h-full w-full",
              )}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                aria-label={`Hình ảnh camera của ${selectedUserName}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-slate-950/70 px-2 py-1 text-xs font-semibold text-white sm:bottom-3 sm:left-3">
                {selectedUserName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLocalExpanded((expanded) => !expanded)}
              aria-label={
                localExpanded
                  ? "Thu nhỏ camera của bạn"
                  : "Phóng to camera của bạn"
              }
              aria-pressed={localExpanded}
              data-video-size={localExpanded ? "main" : "inset"}
              className={cn(
                "absolute overflow-hidden bg-slate-900 text-white transition-[top,right,width,height,border-radius] duration-300 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none",
                localExpanded
                  ? "right-0 top-0 z-10 h-full w-full rounded-none"
                  : "right-3 top-3 z-20 h-28 w-24 rounded-xl border border-white/25 shadow-float sm:right-5 sm:top-5 sm:h-36 sm:w-56",
              )}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                aria-label="Hình ảnh camera của bạn"
                className="h-full w-full -scale-x-100 object-cover"
              />
              <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-md bg-slate-950/70 px-2 py-1 text-xs font-semibold text-white sm:bottom-3 sm:left-3">
                {localExpanded ? "Bạn · Chạm để thu nhỏ" : "Bạn"}
                {!localExpanded && <IoExpandOutline aria-hidden="true" />}
              </span>
            </button>
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-xl bg-surface-muted p-6 text-center">
            <audio
              ref={remoteAudioRef}
              autoPlay
              aria-label={`Âm thanh cuộc gọi từ ${selectedUserName}`}
              className="sr-only"
            />
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-xl font-bold text-accent-foreground">
                {selectedUserName.slice(0, 1).toLocaleUpperCase()}
              </span>
              <p className="mt-4 font-semibold">{selectedUserName}</p>
              <p className="mt-1 text-sm text-muted">
                Đang trò chuyện bằng giọng nói
              </p>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={calling}
        onOpenChange={(open) => {
          if (!open) handleCallingCancel();
        }}
        title="Đang gọi"
        description="Đang chờ người nhận trả lời."
        footer={
          <Button variant="secondary" onClick={handleCallingCancel}>
            Hủy cuộc gọi
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
          />
          <p className="text-sm text-muted">
            Cuộc gọi sẽ kết nối khi người nhận chấp thuận.
          </p>
        </div>
      </Dialog>
    </>
  );
}

export default CallDialogs;
