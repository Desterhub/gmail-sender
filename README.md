# Gmail Bulk Sender & History Manager 🚀

A high-performance personal productivity tool for dispatching 100+ daily personalized bulk emails through your personal Gmail account via the official **Gmail API (`users.messages.send`)**. Includes encrypted token storage at rest, live Server-Sent Events (SSE) progress tracking, throttle regulation, and local SQLite audit history with batch retry support.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS (dark/light theme), Lucide React icons, TanStack Query, Sonner toasts
- **Backend**: Node.js, Express.js
- **Database**: SQLite via `better-sqlite3` (WAL mode enabled, zero external configuration)
- **Authentication**: Google OAuth 2.0 (`googleapis`) with offline access & automated token refresh
- **Security**: AES-256-GCM authenticated encryption for tokens at rest
- **Sending Engine**: RFC 2822 multipart MIME builder with base64url encoding and attachment streaming
- **File Uploads**: `multer` with 25MB aggregate quota validation

---

## 📋 Features Overview

1. **Google OAuth 2.0 Integration**:
   - One-click "Connect Gmail" authorization flow.
   - Scopes: `gmail.send`, `gmail.readonly`, `userinfo.email`.
   - Access & refresh tokens encrypted at rest via AES-256-GCM.
   - Live connected account indicator with instantaneous disconnect option.

2. **Compose & Personalization Engine**:
   - Multi-recipient parsing (comma, newline, or semicolon delimited).
   - Live email validation with green/red status badges and instant count breakdown.
   - Contact list CSV uploader with auto-detected variable columns.
   - Dynamic variable replacement (`{{name}}`, `{{company}}`, `{{topic}}`, etc.).
   - Subject character counter and rich HTML / plain-text editor.
   - Drag-and-drop attachments dropzone with live size calculator and 25MB quota warning.
   - Send modes: **Individual sends** (recipients cannot see each other) or **Single email**.
   - Adjustable throttle rate (default: 20 emails/min) to avoid rate threshold violations.
   - Live modal preview of rendered HTML with variable interpolation.
   - Keyboard shortcuts: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send, <kbd>Ctrl</kbd> + <kbd>K</kbd> for command palette.

3. **Background Dispatch & Live Progress**:
   - Non-blocking queue worker that dispatches emails sequentially respecting rate limits.
   - Live Server-Sent Events (SSE) streaming progress bar to monitor sent/failed ratios in real time.
   - Up to 2 retries with exponential backoff on transient network failures.

4. **Send History & Audit Trail**:
   - Filterable by status, date range, recipient, and subject.
   - Slide-over detail drawer showing complete rendered body, downloadable attachments, failure diagnostics, and direct Gmail deep-links (`https://mail.google.com/mail/u/0/#sent/<id>`).
   - One-click "Resend" for failed emails.
   - "Group by Batch" toggle and instant CSV export.

5. **Batch Management**:
   - Overview of all dispatches with aggregate stats.
   - "Retry Failed Only" batch button.

6. **Reusable Templates**:
   - Pre-seeded with 3 professional templates: Client Follow-up, Product Launch, and Meeting Agenda.
   - Template editor with direct "Use in Compose" loader.

---

## 🔑 Google Cloud Console Setup Guide

To obtain your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Gmail Bulk Sender`) or select an existing one.
3. In the search bar, search for **Gmail API** and click **Enable**.
4. Go to **APIs & Services** > **OAuth consent screen**:
   - Choose User Type: **External** (or Internal if using Google Workspace).
   - Fill in App name (e.g. `Gmail Bulk Sender`), User support email, and Developer contact email.
   - Under **Scopes**, click **Add or Remove Scopes** and add:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Under **Test Users**, add your personal Gmail address (the account you will be sending from).
5. Go to **APIs & Services** > **Credentials**:
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Gmail Bulk Sender Client`.
   - Under **Authorized redirect URIs**, add exactly:
     ```
     http://localhost:3000/auth/google/callback
     ```
   - Click **CREATE**.
6. Copy your **Client ID** and **Client Secret**.

---

## ⚙️ Configuration (`backend/.env`)

Open `backend/.env` and replace the placeholder values with your real credentials:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Paste your credentials from Google Cloud Console:
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Must match exactly what was entered in Google Cloud Console:
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# 32-byte hex key for AES-256-GCM token encryption at rest:
ENCRYPTION_KEY=your_32_byte_hex_encryption_key_here

```

*(You can generate a new random 32-byte key at any time using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)*

---

## 🚀 How to Install & Run

### 1. Install Dependencies
Run the install command from the project root:
```bash
npm run install:all
```
*Or install separately:*
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 1. Quick Start (Automatic 1-Click System) ✨
You do **not** need to open a terminal or type any commands:
- **Double-click `START.bat`** in this folder (or double-click the **Gmail Bulk Sender** shortcut on your Desktop).
- It will automatically:
  1. Load Node.js and verify all dependencies.
  2. Clear any old conflicting processes on ports 3000 & 5173.
  3. Start both the Backend API and Frontend Live Server.
  4. Automatically open `http://localhost:5173` in your default web browser!
- **To Stop**: Close the window or double-click `STOP.bat`.

### 2. Manual Terminal Start (Optional)
If you prefer running commands manually:
```bash
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **OAuth Callback**: [http://localhost:3000/auth/google/callback](http://localhost:3000/auth/google/callback)

### 3. Connect Your Gmail Account
1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Click **Connect Gmail** in the top header or sidebar.
3. Choose your Google account and grant permissions.
4. Once redirected back, you will see a green badge showing your email address.

---

## 📧 How to Send a Bulk Campaign (Complete Workflow)

1. **Set Up Your Signature (One-Time)**
   - Go to **Settings** > **Email Signature**.
   - Paste your signature in the **Rich Editor** or raw **HTML** mode (embedded images `data:...` or `http...` are preserved).
   - Click **Save Signature**.

2. **Prepare Your CSV Contacts File**
   - Create a `.csv` file containing an `email` column along with any custom columns you wish to personalize with, for example:
     ```csv
     email,name,company,title
     alex@example.com,Alex,Acme Corp,Product Lead
     sarah@example.com,Sarah,Stripe,Engineering Manager
     ```

3. **Import Contacts & Review Smart Filters**
   - Navigate to **Compose**.
   - Click **Import from CSV** next to the Recipients header and choose your file.
   - The recipient chips will render with live status indicators:
     - 🟢 **Green ("New")**: Never emailed before.
     - 🟡 **Yellow ("Emailed >7d ago")**: Emailed in the past (hover to see exact date and send count).
     - 🔴 **Red ("Recent ≤7d")**: Emailed within the last 7 days.
   - The smart filter defaults to **Exclude recent (last 7 days)** to protect against duplicate spam. Use the filter buttons to adjust (*Only new*, *Exclude ≤30d*, *Include all*).
   - Click any chip to manually toggle force-include or force-exclude for that specific recipient.

4. **Personalize Your Subject & Body**
   - Click into the **Subject** or **Email Body** editor.
   - Click any variable chip below the body editor (`{{name}}`, `{{company}}`, etc.) to insert that variable directly at your cursor position!
   - If your template references a variable not present in the CSV, a warning banner will appear.

5. **Configure Options & Preview**
   - Toggle **"Append signature to every email"** (default ON).
   - Select throttle rate (default: 20 emails/min = 1 send every 3s).
   - Click **Preview** to see the 1st recipient's rendered email with real variables and signature.

6. **Dispatch & Track Live Progress**
   - Click **Send Campaign** (or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>).
   - You will be redirected to the **Batches** page where live progress updates in real time.
   - When finished, inspect the batch summary: *"Sent 45, Failed 0, Skipped 3 duplicates"*.


## ❓ Troubleshooting & FAQs

### 1. `redirect_uri_mismatch` Error during OAuth
- **Cause**: The redirect URI registered in Google Cloud Console does not match `http://localhost:3000/auth/google/callback`.
- **Fix**: Open Google Cloud Console > APIs & Services > Credentials > your OAuth Client ID > check **Authorized redirect URIs** and make sure `http://localhost:3000/auth/google/callback` is saved without trailing slashes.

### 2. "No refresh token received" or Token Expiration
- **Cause**: Google only provides a `refresh_token` the first time an account grants consent. If re-authenticating after clearing the local database, Google may only return an `access_token`.
- **Fix**: Visit [Google Account Permissions](https://myaccount.google.com/permissions), find **Gmail Bulk Sender**, click **Remove Access**, and then click **Connect Gmail** again in the application.

### 3. "Access blocked: App has not completed the Google verification process"
- **Cause**: Your app is in "Testing" mode on Google Cloud Console.
- **Fix**: In Google Cloud Console > OAuth consent screen > **Test users**, add your Gmail email address.

### 4. "Attachment size exceeds the 25MB limit"
- **Cause**: Gmail limits outgoing message MIME payloads to 25MB total. Base64 encoding adds ~33% overhead.
- **Fix**: The compose screen automatically validates total raw attachment sizes. Keep total attachments under 25MB.

### 5. Port 3000 or 5173 is already in use
- **Fix**: If port 3000 is occupied by another local service, change `PORT` in `backend/.env` and update the proxy port in `frontend/vite.config.js` and Google Cloud Console redirect URI.

---

## 🔒 Security Best Practices
- `.env` and `data.db` are strictly ignored by git.
- Tokens are encrypted with AES-256-GCM before writing to SQLite.
- Content rendering in the preview and drawer is sanitized to prevent XSS.
- Rate limiting middleware protects `/api/send` against abuse.
