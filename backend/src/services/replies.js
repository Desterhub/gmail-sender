const { google } = require('googleapis');
const crypto = require('crypto');
const db = require('../db');
const { getAuthenticatedClient } = require('./gmail');

/**
 * Extracts display name and clean email from RFC 2822 From header
 * e.g. "John Doe <john@example.co.uk>" -> { name: "John Doe", email: "john@example.co.uk" }
 */
function parseSender(rawFrom) {
  if (!rawFrom) return { name: '', email: '' };

  const match = rawFrom.match(/(.*?)<([^>]+)>/);
  if (match) {
    const name = match[1].replace(/["']/g, '').trim();
    const email = match[2].trim().toLowerCase();
    return {
      name: name || email,
      email: email
    };
  }

  const clean = rawFrom.trim().toLowerCase();
  return {
    name: clean,
    email: clean
  };
}

/**
 * Parses Gmail internalDate or Date header into an SQLite-friendly UTC datetime string (YYYY-MM-DD HH:MM:SS)
 */
function parseReceivedDate(dateHeader, internalDate) {
  try {
    if (dateHeader) {
      const parsed = new Date(dateHeader);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().replace('T', ' ').substring(0, 19);
      }
    }
    if (internalDate) {
      const parsed = new Date(parseInt(internalDate, 10));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().replace('T', ' ').substring(0, 19);
      }
    }
  } catch (e) {}
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Safely decodes base64url-encoded body data from Gmail message parts
 */
function decodeBase64Url(data) {
  if (!data) return '';
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (err) {
    console.error('Failed to decode body chunk:', err.message);
    return '';
  }
}

/**
 * Recursively extracts plain text and HTML from a Gmail message payload
 */
function extractBodyParts(payload) {
  let bodyText = '';
  let bodyHtml = '';

  function walk(part) {
    if (!part) return;

    const mimeType = (part.mimeType || '').toLowerCase();

    if (mimeType === 'text/plain' && part.body && part.body.data) {
      bodyText += decodeBase64Url(part.body.data) + '\n';
    } else if (mimeType === 'text/html' && part.body && part.body.data) {
      bodyHtml += decodeBase64Url(part.body.data);
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);

  return {
    bodyText: bodyText.trim(),
    bodyHtml: bodyHtml.trim()
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robust wrapper to fetch message details with automatic backoff retry on 429 quota limits
 */
async function fetchMessageSafe(gmail, messageId, format = 'metadata', headers = null, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const opts = { userId: 'me', id: messageId, format };
      if (headers) opts.metadataHeaders = headers;
      return await gmail.users.messages.get(opts);
    } catch (err) {
      const isQuota = (err.code === 429) || (err.message && err.message.toLowerCase().includes('quota'));
      if (isQuota && attempt < retries - 1) {
        const backoff = (attempt + 1) * 2000;
        console.warn(`[Replies Sync] Rate limit hit for message ${messageId}. Backing off for ${backoff}ms...`);
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Synchronizes replies for a single Gmail account
 */
async function syncSingleAccount(account) {
  let oauth2Client, myEmail;
  try {
    const auth = await getAuthenticatedClient(account.id);
    oauth2Client = auth.oauth2Client;
    myEmail = (auth.email || '').toLowerCase();
  } catch (err) {
    console.error(`Failed to get client for account ${account.email}:`, err.message);
    return { newCount: 0 };
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  let newCount = 0;

  try {
    // 1. Backfill thread_id for sent emails missing thread_id (small batches)
    const emailsMissingThread = db.prepare(`
      SELECT id, gmail_message_id 
      FROM emails 
      WHERE status = 'sent' AND thread_id IS NULL AND gmail_message_id IS NOT NULL 
        AND (account_id = ? OR account_id IS NULL)
      LIMIT 20
    `).all(account.id);

    for (const item of emailsMissingThread) {
      try {
        const msgRes = await fetchMessageSafe(gmail, item.gmail_message_id, 'minimal');
        if (msgRes?.data?.threadId) {
          db.prepare('UPDATE emails SET thread_id = ?, account_id = coalesce(account_id, ?) WHERE id = ?')
            .run(msgRes.data.threadId, account.id, item.id);
        }
        await sleep(60);
      } catch (e) {}
    }

    // 2. Discover incoming messages via targeted search queries
    // Captures standard inbox replies, corporate Exchange auto-replies, and bounces
    const queries = [
      'in:inbox',
      'subject:"Automatic reply" OR subject:"Auto:" OR subject:"Out of office"',
      'subject:"Undeliverable" OR subject:"Delivery Status"'
    ];

    // Add sent campaign subjects
    const batchSubjects = db.prepare('SELECT DISTINCT subject FROM batches WHERE account_id = ? OR account_id IS NULL LIMIT 5').all(account.id);
    for (const b of batchSubjects) {
      if (b.subject && b.subject.length > 5) {
        const clean = b.subject.replace(/["']/g, '').slice(0, 30);
        queries.push(`subject:"${clean}"`);
      }
    }

    // Collect candidate message IDs
    const candidateMsgIds = new Set();
    for (const q of queries) {
      try {
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q,
          maxResults: 60
        });
        if (listRes.data.messages) {
          for (const m of listRes.data.messages) {
            candidateMsgIds.add(m.id);
          }
        }
        await sleep(80);
      } catch (qErr) {
        console.warn(`[Replies Sync] Search query failed: ${q}`, qErr.message);
      }
    }

    // Filter candidate IDs against DB to skip messages we already processed
    const newCandidateIds = [];
    for (const msgId of candidateMsgIds) {
      const existing = db.prepare('SELECT id FROM replies WHERE gmail_message_id = ?').get(msgId);
      if (!existing) {
        newCandidateIds.push(msgId);
      }
    }

    console.log(`[Replies Sync] Found ${newCandidateIds.length} new candidate messages to inspect for ${account.email}`);

    // Process candidate messages with gentle pacing to stay comfortably within quota
    for (const msgId of newCandidateIds) {
      try {
        // Step A: Lightweight metadata fetch first (minimal quota cost)
        const metaRes = await fetchMessageSafe(gmail, msgId, 'metadata', ['From', 'To', 'Subject', 'Date']);
        const headers = metaRes?.data?.payload?.headers || [];
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
        const threadId = metaRes?.data?.threadId;

        const { name: senderName, email: senderEmail } = parseSender(fromHeader);

        // Skip messages sent by our own account
        if (senderEmail && senderEmail === myEmail) {
          continue;
        }

        // MATCH STRATEGY 1: Thread ID correlation
        let matchedEmail = db.prepare(`
          SELECT id, batch_id, to_address 
          FROM emails 
          WHERE thread_id = ? AND (account_id = ? OR account_id IS NULL)
          ORDER BY rowid DESC 
          LIMIT 1
        `).get(threadId, account.id);

        // MATCH STRATEGY 2: Recipient Email matching (Corporate Exchange / Office 365 Auto-Replies)
        if (!matchedEmail && senderEmail) {
          matchedEmail = db.prepare(`
            SELECT id, batch_id, to_address 
            FROM emails 
            WHERE lower(to_address) = lower(?) AND (account_id = ? OR account_id IS NULL)
            ORDER BY rowid DESC 
            LIMIT 1
          `).get(senderEmail, account.id);
        }

        // MATCH STRATEGY 3: Cleaned Subject matching
        const cleanSub = subjectHeader.replace(/^(re:|fwd:|automatic reply:|out of office:|auto:|undeliverable:|delivery status notification:|\[external\]\s*)+/gi, '').trim().toLowerCase();
        if (!matchedEmail && cleanSub.length > 5) {
          matchedEmail = db.prepare(`
            SELECT id, batch_id, to_address 
            FROM emails 
            WHERE lower(subject) LIKE ? AND (account_id = ? OR account_id IS NULL)
            ORDER BY rowid DESC 
            LIMIT 1
          `).get('%' + cleanSub + '%', account.id);
        }

        // MATCH STRATEGY 4: Batch subject matching
        let matchedBatchId = matchedEmail ? matchedEmail.batch_id : null;
        if (!matchedBatchId && cleanSub.length > 5) {
          const batchMatch = db.prepare(`
            SELECT id FROM batches 
            WHERE lower(subject) LIKE ? AND (account_id = ? OR account_id IS NULL)
            ORDER BY created_at DESC LIMIT 1
          `).get('%' + cleanSub + '%', account.id);
          if (batchMatch) matchedBatchId = batchMatch.id;
        }

        // Determine if message belongs to our outreach campaigns
        const isCampaignRelated = !!matchedEmail || 
          !!matchedBatchId || 
          /automatic reply|out of office|undeliverable|delivery status|failure|re:|jolly clamp/i.test(subjectHeader);

        if (!isCampaignRelated) {
          // Unrelated external email (newsletters, notifications, etc.)
          continue;
        }

        // Step B: Fetch full message to get formatted body text and HTML
        const fullMsg = await fetchMessageSafe(gmail, msgId, 'full');
        const receivedAt = parseReceivedDate(dateHeader, fullMsg?.data?.internalDate);
        const { bodyText, bodyHtml } = extractBodyParts(fullMsg?.data?.payload);
        const snippet = fullMsg?.data?.snippet || metaRes?.data?.snippet || '';
        const replyId = crypto.randomUUID();

        db.prepare(`
          INSERT INTO replies (
            id, account_id, email_id, batch_id, thread_id, gmail_message_id,
            from_address, from_name, to_address, subject, snippet,
            body_text, body_html, received_at, is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(
          replyId,
          account.id,
          matchedEmail ? matchedEmail.id : null,
          matchedBatchId,
          threadId,
          msgId,
          senderEmail || fromHeader,
          senderName || fromHeader,
          toHeader || myEmail,
          subjectHeader,
          snippet,
          bodyText,
          bodyHtml,
          receivedAt
        );

        if (matchedEmail) {
          db.prepare(`
            UPDATE emails 
            SET has_reply = 1,
                reply_count = reply_count + 1,
                last_reply_at = ?
            WHERE id = ?
          `).run(receivedAt, matchedEmail.id);
        }

        newCount++;
        console.log(`[Replies Sync] Ingested reply from ${senderName || senderEmail} (${subjectHeader.slice(0, 35)}...)`);

        // Gentle delay between messages to respect Gmail per-minute quota
        await sleep(120);
      } catch (msgErr) {
        console.error(`[Replies Sync] Error processing candidate message ${msgId}:`, msgErr.message);
      }
    }

    // 3. Fallback: Quick check on recent sent threads (limit 15) for nested conversation replies
    const recentThreads = db.prepare(`
      SELECT DISTINCT thread_id 
      FROM emails 
      WHERE status = 'sent' AND thread_id IS NOT NULL 
        AND (account_id = ? OR account_id IS NULL)
      ORDER BY coalesce(sent_at, datetime('now')) DESC 
      LIMIT 15
    `).all(account.id);

    for (const t of recentThreads) {
      try {
        const threadRes = await gmail.users.threads.get({
          userId: 'me',
          id: t.thread_id,
          format: 'full'
        });

        const messages = threadRes?.data?.messages || [];
        if (messages.length > 1) {
          for (const msg of messages) {
            const existingReply = db.prepare('SELECT id FROM replies WHERE gmail_message_id = ?').get(msg.id);
            if (existingReply) continue;

            const headers = msg.payload?.headers || [];
            const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
            const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

            const { name: senderName, email: senderEmail } = parseSender(fromHeader);
            if (senderEmail && senderEmail === myEmail) continue;

            const matchedEmail = db.prepare(`
              SELECT id, batch_id 
              FROM emails 
              WHERE thread_id = ? 
              ORDER BY rowid DESC 
              LIMIT 1
            `).get(t.thread_id);

            const receivedAt = parseReceivedDate(dateHeader, msg.internalDate);
            const { bodyText, bodyHtml } = extractBodyParts(msg.payload);
            const snippet = msg.snippet || '';
            const replyId = crypto.randomUUID();

            db.prepare(`
              INSERT INTO replies (
                id, account_id, email_id, batch_id, thread_id, gmail_message_id,
                from_address, from_name, to_address, subject, snippet,
                body_text, body_html, received_at, is_read, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
            `).run(
              replyId,
              account.id,
              matchedEmail ? matchedEmail.id : null,
              matchedEmail ? matchedEmail.batch_id : null,
              t.thread_id,
              msg.id,
              senderEmail || fromHeader,
              senderName || fromHeader,
              toHeader || myEmail,
              subjectHeader,
              snippet,
              bodyText,
              bodyHtml,
              receivedAt
            );

            if (matchedEmail) {
              db.prepare(`
                UPDATE emails 
                SET has_reply = 1,
                    reply_count = reply_count + 1,
                    last_reply_at = ?
                WHERE id = ?
              `).run(receivedAt, matchedEmail.id);
            }

            newCount++;
          }
        }
        await sleep(80);
      } catch (tErr) {}
    }

    return { newCount };
  } catch (err) {
    console.error(`Error syncing replies for ${account.email}:`, err.message);
    return { newCount };
  }
}

/**
 * Synchronizes inbound replies from Gmail across specified account or all accounts
 */
async function syncReplies(specificAccountId = null) {
  let accountsToSync = [];
  if (specificAccountId) {
    const acc = db.prepare('SELECT id, email FROM accounts WHERE id = ?').get(specificAccountId);
    if (acc) accountsToSync.push(acc);
  } else {
    accountsToSync = db.prepare('SELECT id, email FROM accounts ORDER BY connected_at DESC').all();
  }

  if (accountsToSync.length === 0) {
    return {
      success: false,
      error: 'No connected accounts found'
    };
  }

  let totalNew = 0;
  for (const acc of accountsToSync) {
    const res = await syncSingleAccount(acc);
    totalNew += res.newCount;
  }

  const totalCount = db.prepare('SELECT COUNT(*) as count FROM replies').get().count;

  return {
    success: true,
    newReplies: totalNew,
    totalReplies: totalCount,
    syncedAt: new Date().toISOString()
  };
}

module.exports = {
  syncReplies,
  parseSender,
  extractBodyParts
};
