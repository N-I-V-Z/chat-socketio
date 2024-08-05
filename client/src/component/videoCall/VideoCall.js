import React, { useEffect, useRef } from 'react';
import Peer from 'simple-peer';

const VideoCall = ({ isInitiator, signalingData, onSignalData, onEndCall }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peer = new Peer({
          initiator: isInitiator,
          trickle: false,
          stream: stream,
        });

        peerRef.current = peer;
        
        peer.on('stream', remoteStream => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            console.log('Remote video stream set:', remoteVideoRef.current.srcObject);
          }
        });
        
        peer.on('signal', data => {
          onSignalData(data);
        });

        if (!isInitiator && signalingData) {
          peer.signal(signalingData);
        }

        peer.on('error', (err) => {
          console.error('Peer error:', err);
        });
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };

    startCall();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [isInitiator, signalingData, onSignalData]);

  useEffect(() => {
    if (signalingData && peerRef.current) {
      peerRef.current.signal(signalingData);
    }
  }, [signalingData]);

  return (
    <div className="video-call">
      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted />
        <video ref={remoteVideoRef} autoPlay />
      </div>
      <div className='btn-end-call' onClick={onEndCall}>
        End Call
      </div>
    </div>
  );
};

export default VideoCall;
