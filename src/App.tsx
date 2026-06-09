/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useChatStore } from "./store";
import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import VideoCallModal from "./components/VideoCallModal";
import AdminDashboard from "./components/AdminDashboard";
import { Heart, Menu, ShieldAlert, ArrowLeft } from "lucide-react";

export default function App() {
  const { user, setUser, activeFriend, setActiveFriend, initSocket, disconnectSocket } = useChatStore();
  const [showAdminConsoleOverride, setShowAdminConsoleOverride] = useState(false);

  // Sync user logging statuses and push configurations
  useEffect(() => {
    // 1. Recover standard session user from local endpoint automatically
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const verifiedUser = await res.json();
          setUser(verifiedUser);
          if (verifiedUser.isAdmin) {
            setShowAdminConsoleOverride(true);
          }
        }
      } catch (err) {
        // Safe to ignore if not logged in
      }
    };
    fetchMe();

    // 2. Request push notification permissions up-front
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      disconnectSocket();
    };
  }, []);

  // Socket sync triggers
  useEffect(() => {
    if (user) {
      if (user.isAdmin) {
        setShowAdminConsoleOverride(true);
      }
    } else {
      setShowAdminConsoleOverride(false);
    }
  }, [user?.id]);


  // Unauthenticated screen
  if (!user) {
    return <AuthPage />;
  }

  // Admin Oversight console view
  if (user.isAdmin && showAdminConsoleOverride) {
    return (
      <div id="admin-overall-wrapper" className="min-h-screen bg-slate-950 flex flex-col">
        {/* Helper bar to swap back to core chat modes for admin testing */}
        <div className="bg-rose-900/10 px-6 py-2 border-b border-rose-950/20 text-center flex items-center justify-between text-xs font-bold text-rose-500">
          <span>You are logged in as System Overseer</span>
          <button
            onClick={() => setShowAdminConsoleOverride(false)}
            className="hover:underline text-white bg-rose-950 py-1 px-3 rounded-lg border border-rose-900"
          >
            Switch to Chat Mode
          </button>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div id="app-messaging-layout" className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden font-sans relative antialiased text-slate-800">
      
      {/* Top level global WebRTC Calling Modals */}
      <VideoCallModal />

      {/* Admin helper bar back to panel */}
      {user.isAdmin && !showAdminConsoleOverride && (
        <div className="bg-rose-950 px-6 py-2 flex items-center justify-between text-xs font-bold text-rose-200">
          <span>Viewing Family Chat panel</span>
          <button
            onClick={() => setShowAdminConsoleOverride(true)}
            className="hover:underline bg-rose-900 text-white py-1 px-3.5 rounded-lg"
          >
            Back to Operator Console
          </button>
        </div>
      )}

      {/* Flawless responsive viewport routing */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Mobile Viewports: Toggle Sidebar lists vs active chat thread */}
        <div className="flex md:hidden w-full h-full relative">
          {!activeFriend ? (
            <div className="w-full h-full flex flex-col">
              <Sidebar />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col relative">
              {/* Back button to return to friend list on smaller touchscreens */}
              <button
                onClick={() => setActiveFriend(null)}
                className="absolute left-4 top-4.5 z-40 bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-sm border border-slate-200/50"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
              </button>
              <ChatArea />
            </div>
          )}
        </div>

        {/* Desktop Viewports: Side-by-side Layout panels */}
        <div className="hidden md:flex w-full h-full overflow-hidden">
          <Sidebar />
          <ChatArea />
        </div>

      </div>

    </div>
  );
}
