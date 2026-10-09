const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const sendRoutes = require('./routes/send');
const historyRoutes = require('./routes/history');
const batchesRoutes = require('./routes/batches');
const templatesRoutes = require('./routes/templates');
const repliesRoutes = require('./routes/replies');
const settingsRoutes = require('./routes/settings');
const { syncReplies } = require('./services/replies');

// Initialize database
const db = require('./db');

// Normalize any interrupted batches that were left in 'sending' status on server restart
try {
  const interrupted = db.prepare("UPDATE batches SET status = 'partial' WHERE status = 'sending'").run();
  if (interrupted.changes > 0) {
    console.log(`[Startup] Recovered ${interrupted.changes} interrupted batch(es) to 'partial' status.`);
  }
} catch (e) {
  // Ignore
}

const app = express();
const rateLimit = require('express-rate-limit');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Enterprise Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// API Rate Limiting to prevent brute-force attacks and abuse
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 180, // Max 180 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this client. Please try again in a moment.' }
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Register routes
app.use(authRoutes);
app.use(sendRoutes);
app.use(historyRoutes);
app.use(batchesRoutes);
app.use(templatesRoutes);
app.use(repliesRoutes);
app.use(settingsRoutes);

// Central error handler
app.use((err, req, res, next) => {
  // Do not log secrets or sensitive payload
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` Gmail Bulk Sender & History Manager Backend running`);
  console.log(` Local Security Isolation: Bound strictly to http://${HOST}:${PORT}`);
  console.log(` OAuth Callback URI: http://localhost:${PORT}/auth/google/callback`);
  console.log(`====================================================`);

  // Background reply sync: initial sync after 10s, then periodically every 5 minutes
  setTimeout(() => {
    syncReplies()
      .then(res => {
        if (res && res.newReplies > 0) {
          console.log(`[Replies Sync] Discovered ${res.newReplies} new reply/replies.`);
        }
      })
      .catch(err => {
        // Silently log or ignore
      });

    setInterval(() => {
      syncReplies().catch(() => {});
    }, 5 * 60 * 1000);
  }, 10000);
});
