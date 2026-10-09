# Gmail Bulk Sender & Campaign Manager 🚀

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-OAuth_2.0-4285F4?style=flat-square&logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A high-performance personal productivity tool for dispatching personalized bulk email campaigns through your personal Gmail account via the official **Google Gmail API (`users.messages.send`)**.

Built with a modern full-stack architecture featuring **AES-256-GCM encrypted token storage**, **Server-Sent Events (SSE)** for live progress streaming, throttling controls, and an audit history powered by **SQLite (WAL mode)**.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies | Key Highlights |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TailwindCSS | Dark/Light mode, Lucide icons, TanStack Query, Sonner toasts |
| **Backend API** | Node.js, Express.js | REST endpoints, Server-Sent Events (SSE) streaming worker |
| **Database** | SQLite via `better-sqlite3` | Zero-config, ultra-fast embedded storage with WAL mode |
| **Authentication** | Google OAuth 2.0 (`googleapis`) | Offline access, automated token refresh lifecycle |
| **Security** | AES-256-GCM | Encrypted token storage at rest, sanitized HTML preview |
| **Sending Engine** | RFC 2822 Multipart MIME | Attachment streaming up to 25MB, base64url encoding |

---

## ✨ Key Features

### 1. 🔐 Secure Google OAuth 2.0 Integration
- One-click Gmail authentication flow with least-privilege scopes (`gmail.send`, `gmail.readonly`, `userinfo.email`).
- Refresh tokens and access tokens are encrypted at rest with **AES-256-GCM** before writing to SQLite.
- Seamless automatic token renewal on expiry.

### 2. 📝 Compose & Personalization Engine
- **Multi-Recipient Input**: Comma, semicolon, or newline-separated recipient lists with instant syntax & deduplication validation.
- **CSV Contact List Import**: Automatic variable column detection (`{{name}}`, `{{company}}`, `{{topic}}`, etc.).
- **Smart Duplicate Protection**: Visual chip badges identifying recipients emailed within the last 7 or 30 days to prevent redundant sends.
- **Rich Editor & Dynamic Variables**: Real-time cursor interpolation, subject character counters, and HTML modal preview.
- **Drag-and-Drop Attachments**: Live size calculations with 25MB aggregate quota validation.

### 3. ⚡ Background Queue & Live SSE Streaming
- Sequential non-blocking dispatch queue with configurable throttling (e.g., 20 emails/minute) to maintain healthy sender reputation.
- **Server-Sent Events (SSE)** channel providing real-time sent/failed progress metrics directly to the client.
- Exponential backoff retry mechanism on transient network or API thresholds.

### 4. 📊 Audit Trail, Batches & History
- Comprehensive send logs searchable by status, date range, recipient, and subject.
- Slide-over detail drawer with rendered email previews, attachment downloads, error logs, and direct Gmail deep links (`mail.google.com/mail/u/0/#sent/<id>`).
- One-click retry for failed dispatches and CSV report export.

### 5. 📑 Reusable Email Templates
- Built-in template manager with pre-configured templates for client follow-ups, product announcements, and meetings.
- One-click template loader into the Compose screen.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or newer)
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Desterhub/gmail-sender.git
cd gmail-sender
```

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Set up environment variables
Copy the example environment file:
```bash
cp backend/.env.example backend/.env
```
Add your Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a 32-byte `ENCRYPTION_KEY`) in `backend/.env`.

### 4. Run the application
```bash
npm run dev
```
- **Web App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`

*(On Windows, you can also launch the entire app by double-clicking `START.bat`)*

---

## 🔒 Security Best Practices
- **No Credentials in Version Control**: `.env` and SQLite database files (`*.db`) are strictly ignored.
- **AES-256-GCM Encryption**: Token data is stored encrypted with an initialization vector and authentication tag.
- **Sanitized HTML**: All previewed user input is sanitized to protect against cross-site scripting (XSS).
- **Rate-Limiting**: Queue middleware prevents abusive request dispatching.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
