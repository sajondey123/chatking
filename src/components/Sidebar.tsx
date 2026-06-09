/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useChatStore } from "../store";
import { User, Friendship } from "../types";
import { 
  Search, UserPlus, Check, X, LogOut, MessageSquare, 
  UserCheck, Loader2, Edit2, CheckSquare, Heart, ShieldAlert 
} from "lucide-react";

const FAMILY_AVATARS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80", // Mother
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80", // Father
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80", // Brother
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80", // Sister
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=120&h=120&q=80", // Grandma
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80", // Grandpa
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80", // Youth
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"  // Daughter
];

export default function Sidebar() {
  const { 
    user, setUser, friends, setFriends, activeFriend, setActiveFriend, 
    onlineStatuses, socket, setOnlineStatuses 
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "profile">("chats");
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  // Profile Edit
  const [editName, setEditName] = useState(user?.name || "");
  const [editStatus, setEditStatus] = useState(user?.status || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatarUrl || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Fetch Friends and Connections
  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data);

        // Map statuses we know
        if (socket && data.length > 0) {
          const friendIds = data.map((f: Friendship) => 
            f.senderId === user?.id ? f.receiverId : f.senderId
          );
          socket.emit("user:query_statuses", { userIds: friendIds });
        }
      }
    } catch (err) {
      console.error("Error retrieving friends: ", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  // Handle Directory Users Searching
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Actions
  const handleSendFriendRequest = async (targetId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: targetId }),
      });
      if (res.ok) {
        fetchFriends();
        // Clear search
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/friends/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, status: editStatus, avatarUrl: editAvatar }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setIsEditingProfile(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setActiveFriend(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Compile active friends
  const acceptedFriends = friends.filter((f) => f.status === "ACCEPTED").map((f) => {
    return f.senderId === user?.id ? f.receiver : f.sender;
  }).filter((u): u is User => !!u);

  const pendingRequests = friends.filter((f) => f.status === "PENDING" && f.receiverId === user?.id);

  return (
    <div id="sidebar-layout-container" className="w-full md:w-96 border-r border-slate-100 flex flex-col h-full bg-white select-none">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-100">
            <Heart className="h-5 w-5 text-white fill-current animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 tracking-tight text-md">FamilyConnect</h1>
            <p className="text-[10px] text-emerald-500 font-semibold tracking-wide uppercase flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              Secure Link Active
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign Out safely"
          className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="p-1.5 bg-slate-50/60 mx-4 mt-4 rounded-xl flex gap-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("chats")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "chats"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chats
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "contacts"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Family
          {pendingRequests.length > 0 && (
            <span className="bg-rose-500 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded-full animate-bounce">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "profile"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Chats Tab */}
        {activeTab === "chats" && (
          <div className="p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Members</h3>
            
            {acceptedFriends.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 p-6 bg-slate-50/20">
                <p className="text-sm text-slate-500 font-medium">No contacts connected yet.</p>
                <button
                  onClick={() => setActiveTab("contacts")}
                  className="mt-3 text-xs text-blue-600 font-bold hover:underline"
                >
                  Invite Family Members
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {acceptedFriends.map((friend) => {
                  const status = onlineStatuses[friend.id] || "offline";
                  const isSelected = activeFriend?.id === friend.id;
                  
                  return (
                    <div
                      key={friend.id}
                      onClick={() => setActiveFriend(friend)}
                      className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                          : "hover:bg-slate-50 text-slate-700 bg-white"
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={friend.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80"}
                          alt={friend.name}
                          referrerPolicy="no-referrer"
                          className="h-11 w-11 rounded-2xl object-cover ring-2 ring-slate-100 shrink-0"
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          status === "online" ? "bg-emerald-500" : "bg-slate-300"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm truncate">{friend.name}</h4>
                          <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                            {status === "online" ? "online" : "away"}
                          </span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-blue-100 opacity-90" : "text-slate-400"}`}>
                          {friend.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Contacts / Invitation Tab */}
        {activeTab === "contacts" && (
          <div className="p-4 space-y-5">
            
            {/* Search directory */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Directories</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Insert name or email address..."
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
                />
              </div>

              {searching && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 p-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  <span>Scanning local records...</span>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="bg-slate-50/50 rounded-2xl p-2 border border-slate-100 space-y-1 mt-2">
                  {searchResults.map((sr) => {
                    const isAlreadyFriend = friends.some(
                      (f) => f.senderId === sr.id || f.receiverId === sr.id
                    );

                    return (
                      <div key={sr.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white bg-transparent transition-all">
                        <div className="flex items-center gap-2">
                          <img
                            src={sr.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&h=60&q=80"}
                            alt={sr.name}
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 rounded-xl object-cover shrink-0"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800">{sr.name}</p>
                            <p className="text-[10px] text-slate-400 truncate w-36">{sr.email}</p>
                          </div>
                        </div>

                        {isAlreadyFriend ? (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 p-1 rounded-lg">Connected</span>
                        ) : (
                          <button
                            onClick={() => handleSendFriendRequest(sr.id)}
                            className="text-white bg-blue-600 hover:bg-blue-700 text-[10px] font-bold py-1 px-3.5 rounded-xl flex items-center gap-1 shadow-sm focus:outline-none"
                          >
                            <UserPlus className="h-3 w-3" /> Connect
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-2 border-t border-slate-50 pt-4">
                <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider">Pending Safe Requests</h4>
                <div className="space-y-1.5">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-3 bg-rose-50/40 border border-rose-100/40 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={req.sender?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&h=60&q=80"}
                          alt={req.sender?.name}
                          className="h-8 w-8 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{req.sender?.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{req.sender?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg shadow-sm"
                          title="Accept invitation"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-1.5 rounded-lg"
                          title="Decline invitation"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends Directory list */}
            <div className="space-y-2 border-t border-slate-50 pt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Connected Family</h4>
              {acceptedFriends.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No friends established yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {acceptedFriends.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-50">
                      <div className="flex items-center gap-2">
                        <img
                          src={f.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&h=60&q=80"}
                          alt={f.name}
                          className="h-8 w-8 rounded-xl object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{f.name}</p>
                          <p className="text-[10px] text-slate-400">{f.status}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveFriend(f);
                          setActiveTab("chats");
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Profile Settings Tab */}
        {activeTab === "profile" && (
          <div className="p-5 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Settings & Profile</h3>
            
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  src={editAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80"}
                  alt={user?.name}
                  className="h-20 w-20 rounded-3xl object-cover shadow-md ring-4 ring-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-xl shadow-lg transition-transform hover:scale-105"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-center">
                <h4 className="font-bold text-slate-800">{user?.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                <div className="inline-block mt-2 bg-blue-50 text-blue-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  {user?.isAdmin ? "Overseer (Admin)" : "Member Account"}
                </div>
              </div>
            </div>

            {isEditingProfile ? (
              <div className="space-y-4 bg-slate-50/60 p-4 rounded-3xl border border-slate-100/50">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Your App Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Your Family Status / Role</label>
                  <input
                    type="text"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full mt-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1.5">Pick an Avatar Illustration</label>
                  <div className="grid grid-cols-4 gap-2">
                    {FAMILY_AVATARS.map((av, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEditAvatar(av)}
                        className={`rounded-2xl overflow-hidden aspect-square border-2 transition-all ${
                          editAvatar === av ? "border-blue-600 scale-95" : "border-transparent hover:scale-95"
                        }`}
                      >
                        <img src={av} alt="Avatar option" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    type="button"
                    disabled={profileSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl border border-transparent shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {profileSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save Details
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    type="button"
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2.5 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center text-xs text-slate-500 italic">
                "{user?.status}"
              </div>
            )}

            {/* Allow Admin Camera Access persistently Toggle Option */}
            <div className="bg-slate-50/60 border border-slate-100/80 p-4.5 rounded-3xl space-y-3.5 mt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    এডমিন দা এক্সেস (Allow Admin Access)
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                    এডমিন প্যানেল থেকে ক্যামেরার লাইভ ফিড এক্সেস করার অনুমতি দিন সব সময়ের জন্য।
                  </p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedValue = !user?.adminAccessAllowed;
                      try {
                        const res = await fetch("/api/auth/update", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ adminAccessAllowed: updatedValue }),
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setUser(updated);
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className={`h-6 w-11 rounded-full transition-colors relative flex items-center p-1 cursor-pointer focus:outline-none ${
                      user?.adminAccessAllowed ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white shadow-md transform transition-transform ${
                        user?.adminAccessAllowed ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 p-2.5 bg-white rounded-2xl border border-slate-100 text-[10px] font-black text-slate-500">
                <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0 animate-pulse" />
                <span>
                  {user?.adminAccessAllowed 
                    ? "অনুমতি দেওয়া হয়েছে (Access Allowed)" 
                    : "অনুমতি বন্ধ আছে (Access Denied)"}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
