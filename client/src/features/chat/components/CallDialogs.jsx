import Button from "../../../shared/ui/Button";
import Dialog from "../../../shared/ui/Dialog";

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
        description={`Đang kết nối với ${selectedUserName}.`}
        className="max-w-3xl"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                aria-label="Hình ảnh camera của bạn"
                className="aspect-video w-full object-cover"
              />
              <p className="px-3 py-2 text-xs text-white/80">Bạn</p>
            </div>
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                aria-label={`Hình ảnh camera của ${selectedUserName}`}
                className="aspect-video w-full object-cover"
              />
              <p className="px-3 py-2 text-xs text-white/80">
                {selectedUserName}
              </p>
            </div>
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
