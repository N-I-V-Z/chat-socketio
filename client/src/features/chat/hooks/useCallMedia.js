import { useCallback, useRef } from "react";

function useCallMedia({
  socket,
  receiverIdRef,
  callIdRef,
  setCallHasVideo,
  setCalling,
  setIsCallModalVisible,
  toast,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const callGenerationRef = useRef(0);

  const stopLocalMedia = useCallback(() => {
    callGenerationRef.current += 1;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    for (const mediaRef of [localVideoRef, remoteVideoRef, remoteAudioRef]) {
      if (mediaRef.current) mediaRef.current.srcObject = null;
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
  }, []);

  const addIceCandidateSafely = useCallback(async (connection, candidate) => {
    try {
      if (connection.remoteDescription?.type) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (error) {
      console.error("Could not add the ICE candidate", error);
    }
  }, []);

  const flushIceCandidateQueue = useCallback(async (connection) => {
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Could not add queued ICE candidate", error);
      }
    }
  }, []);

  const initializePeerConnection = useCallback(
    async (video, shouldCreateOffer = false) => {
      const generation = ++callGenerationRef.current;
      setCallHasVideo(Boolean(video));
      iceCandidateQueueRef.current = [];
      closePeerConnection();

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      connection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            iceCandidate: event.candidate,
            to: receiverIdRef.current,
            callId: callIdRef.current,
          });
        }
      };
      connection.ontrack = (event) => {
        const mediaElement = video
          ? remoteVideoRef.current
          : remoteAudioRef.current;
        if (mediaElement) mediaElement.srcObject = event.streams[0];
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video ?? false,
          audio: true,
        });
        if (generation !== callGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          connection.close();
          return null;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => {
          if (connection.signalingState !== "closed") {
            connection.addTrack(track, stream);
          }
        });
        peerConnectionRef.current = connection;

        if (shouldCreateOffer) {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          if (generation !== callGenerationRef.current) return null;
          socket.emit("offer", {
            offer,
            to: receiverIdRef.current,
            callId: callIdRef.current,
          });
        }
        return connection;
      } catch (error) {
        connection.close();
        if (generation !== callGenerationRef.current) return null;
        stopLocalMedia();
        peerConnectionRef.current = null;
        setCalling(false);
        setIsCallModalVisible(false);
        toast("Không thể truy cập micro hoặc camera.", "error");
        return null;
      }
    },
    [
      callIdRef,
      closePeerConnection,
      receiverIdRef,
      setCallHasVideo,
      setCalling,
      setIsCallModalVisible,
      socket,
      stopLocalMedia,
      toast,
    ],
  );

  return {
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    peerConnectionRef,
    stopLocalMedia,
    closePeerConnection,
    initializePeerConnection,
    addIceCandidateSafely,
    flushIceCandidateQueue,
  };
}

export default useCallMedia;
