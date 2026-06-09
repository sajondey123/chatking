/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useChatStore } from "../store";
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  VolumeX, Volume2, ShieldAlert, Wifi 
} from "lucide-react";

export default function VideoCallModal() {
  const { user, activeCall, updateCallStatus, endCall, socket } = useChatStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(activeCall?.type === "AUDIO");
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Timer for duration tracking
  useEffect(() => {
    let interval: any = null;
    if (activeCall?.status === "ONGOING") {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Request browser media inputs and start WebRTC connection
  useEffect(() => {
    if (!activeCall) return;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: activeCall.type === "VIDEO",
          audio: true,
        }).catch(() => null);

        if (stream) {
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.error("Camera access failed: ", err);
      }
    };

    if (activeCall.status === "ONGOING" || (!activeCall.isIncoming && activeCall.status === "RINGING")) {
      startMedia();
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [activeCall?.id, activeCall?.status]);


  // Establish real RTCPeerConnection for mult-tab setups
  useEffect(() => {
    if (!socket || !activeCall || activeCall.status !== "ONGOING") return;

    const partnerId = activeCall.isIncoming ? activeCall.callerId : activeCall.receiverId;

    const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Push local streams
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Capture remote streams
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    // Forward ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("call:ice_candidate_relay", {
          targetUserId: partnerId,
          candidate: event.candidate,
        });
      }
    };

    // Listeners for remote triggers
    socket.on("call:peer_ice_candidate", (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    });

    socket.on("call:peer_hangup", () => {
      handleFinalizeCall("COMPLETED");
    });

    socket.on("call:peer_media_status", ({ audioMuted, videoOff }) => {
      // Show micro details of partner status
      console.log(`Remote media adjustment: Audio is ${audioMuted}, Video is ${videoOff}`);
    });

    // If caller, send WebRTC Offer
    const triggerOffer = async () => {
      if (!activeCall.isIncoming) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:outgoing_initiate", {
          callerId: activeCall.callerId,
          receiverId: activeCall.receiverId,
          type: activeCall.type,
          signalData: offer,
          callerName: user?.name,
          callerAvatar: user?.avatarUrl,
        });
      } else if (activeCall.signalData) {
        // If receiver, handle Offer and send WebRTC Answer
        await pc.setRemoteDescription(new RTCSessionDescription(activeCall.signalData));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:incoming_answer_relay", {
          callerId: activeCall.callerId,
          receiverId: activeCall.receiverId,
          signalData: answer,
        });
      }
    };

    socket.on("call:connection_completed", async ({ signalData }) => {
      if (pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
      }
    });

    triggerOffer();

    return () => {
      socket.off("call:peer_ice_candidate");
      socket.off("call:peer_hangup");
      socket.off("call:peer_media_status");
      socket.off("call:connection_completed");
    };
  }, [localStream, activeCall?.status]);


  const handleAcceptCall = () => {
    updateCallStatus("ONGOING");
  };

  const handleDeclineCall = () => {
    const partnerId = activeCall?.isIncoming ? activeCall.callerId : activeCall?.receiverId;
    if (socket && partnerId) {
      socket.emit("call:terminated", { targetUserId: partnerId });
    }
    handleFinalizeCall("REJECTED");
  };

  const handleFinalizeCall = async (status: "COMPLETED" | "REJECTED" | "MISSED") => {
    // Terminate local streams
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }

    // Write Call entries back to SQL logs
    if (activeCall && !activeCall.isIncoming) {
      try {
        await fetch("/api/calls/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiverId: activeCall.receiverId,
            type: activeCall.type,
            status,
            duration,
          }),
        });
      } catch (err) {
        console.error("Call logger failed: ", err);
      }
    }

    endCall();
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Notify other peer
        const partnerId = activeCall?.isIncoming ? activeCall.callerId : activeCall?.receiverId;
        if (socket && partnerId) {
          socket.emit("call:media_control", {
            targetUserId: partnerId,
            audioMuted: !audioTrack.enabled,
            videoOff: isVideoOff,
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        
        // Notify other peer
        const partnerId = activeCall?.isIncoming ? activeCall.callerId : activeCall?.receiverId;
        if (socket && partnerId) {
          socket.emit("call:media_control", {
            targetUserId: partnerId,
            audioMuted: isMuted,
            videoOff: !videoTrack.enabled,
          });
        }
      }
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!activeCall) return null;

  return (
    <div id="video-call-modal-overlay" className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex flex-col justify-center items-center z-50 p-6 select-none font-sans">
      
      {/* Call Ringing / Incoming Invitation Card */}
      {activeCall.status === "RINGING" && (
        <div id="ringing-card" className="bg-slate-800 text-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-700 space-y-6 animate-pulse">
          <div className="relative inline-block">
            <img
              src={activeCall.partnerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80"}
              alt={activeCall.partnerName}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-500 mx-auto"
            />
            <span className="absolute bottom-1 right-2 bg-blue-500 text-[10px] p-1 px-2 rounded-full font-bold flex items-center gap-1">
              <Wifi className="h-2.5 w-2.5" /> Direct
            </span>
          </div>

          <div>
            <h3 className="text-xl font-bold">{activeCall.partnerName}</h3>
            <p className="text-slate-400 text-xs mt-1 animate-bounce">
              {activeCall.isIncoming 
                ? `Incoming Family ${activeCall.type} call...`
                : `Calling family ${activeCall.type.toLowerCase()} stream...`}
            </p>
          </div>

          <div className="flex justify-center gap-6 pt-2">
            {activeCall.isIncoming ? (
              <>
                <button
                  onClick={handleAcceptCall}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white p-4.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Phone className="h-6 w-6 text-white fill-current" />
                </button>
                <button
                  onClick={handleDeclineCall}
                  className="bg-rose-500 hover:bg-rose-600 text-white p-4.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <PhoneOff className="h-6 w-6 text-white" />
                </button>
              </>
            ) : (
              <button
                onClick={handleDeclineCall}
                className="bg-rose-500 hover:bg-rose-600 text-white p-4.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneOff className="h-6 w-6 text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ongoing Streaming Controls Layer */}
      {activeCall.status === "ONGOING" && (
        <div id="ongoing-stream-panel" className="w-full max-w-4xl flex-1 flex flex-col items-center justify-between py-6 rounded-3xl relative overflow-hidden">
          
          <div className="absolute top-4 inset-x-0 text-center z-10">
            <span className="bg-slate-800/80 text-white text-[11px] font-semibold py-1.5 px-4 rounded-full border border-slate-700/60 inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              Secure Stream: {formatDuration(duration)}
            </span>
          </div>

          {/* Dual Feed Canvas Area */}
          <div className="flex-1 w-full bg-slate-950 rounded-3xl border border-slate-800/60 relative overflow-hidden shadow-2xl flex items-center justify-center">
            
            {/* Remote Partner Feed */}
            {activeStreamExists(remoteStream) ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              // Simulation / No Camera Placeholder card
              <div className="text-center p-8 space-y-3">
                <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <VideoOff className="h-8 w-8" />
                </div>
                <h4 className="font-semibold text-white text-sm">{activeCall.partnerName}</h4>
                <p className="text-slate-500 text-xs">Waiting for video stream node link...</p>
              </div>
            )}

            {/* Local Picture-in-Picture Preview Box */}
            <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden z-20">
              {localStream && !isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600 text-[10px] font-bold">
                  Camera Off
                </div>
              )}
            </div>
          </div>

          {/* Overlay Feed Action controllers */}
          <div className="mt-8 flex items-center gap-5 z-10">
            <button
              onClick={toggleMic}
              className={`p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-white border ${
                isMuted 
                  ? "bg-rose-500 border-rose-400" 
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              onClick={() => handleFinalizeCall("COMPLETED")}
              className="bg-rose-600 hover:bg-rose-700 text-white p-5 rounded-3xl shadow-xl hover:scale-105 active:scale-95 transition-all border border-rose-500"
            >
              <PhoneOff className="h-6 w-6 text-white" />
            </button>

            {activeCall.type === "VIDEO" && (
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-white border ${
                  isVideoOff 
                    ? "bg-rose-500 border-rose-400" 
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700"
                }`}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

// Check helper
function activeStreamExists(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some(track => track.enabled);
}
