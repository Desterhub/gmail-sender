const { ImapFlow } = require('imapflow');
const crypto = require('crypto');
const db = require('../db');
const { getSmtpConfig } = require('./smtp');
const { parseSender } = require('./replies');

/**
 * Parses RFC 2822 or Date object into SQLite-compatible UTC datetime
 */
function parseDateToSqlite(d) {
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().replace('T', ' ').substring(0, 19);
    }
  } catch (e) {}
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Synchronizes incoming customer replies and automatic responses via IMAP
 * Uses standard IMAP4rev1 over TLS (e.g. imap.gmail.com:993 with Google App Password)
 * @param {number|null} accountId
 * @returns {Promise<{ success: boolean, newCount: number, totalReplies: number }>}
 */
async function syncRepliesViaImap(accountId = null) {
  const config = getSmtpConfig(accountId);
  if (!config || !config.user || !config.pass) {
    return { success: false, newCount: 0, error: 'No IMAP credentials configured' };
  }

  const account = accountId 
    ? db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId)
    : db.prepare('SELECT * FROM accounts ORDER BY id ASC LIMIT 1').get();

  const imapHost = (account && account.imap_host) ? account.imap_host : 'imap.gmail.com';
  const imapPort = (account && account.imap_port) ? parseInt(account.imap_port, 10) : 993;

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: config.user.trim(),
      pass: config.pass.replace(/\s+/g, '').trim()
    },
    logger: false
  });

  let newCount = 0;

  try {
    await client.connect();

    // Lock INBOX
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Look back 14 days for recent customer responses and auto-replies
      const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const searchCriteria = { since: sinceDate };

      // Fetch message sequence numbers matching criteria
      const messageSeqNumbers = await client.search(searchCriteria);
      if (!messageSeqNumbers || messageSeqNumbers.length === 0) {
        return { success: true, newCount: 0 };
      }

      // Take last 80 messages
      const recentSeq = messageSeqNumbers.slice(-80);

      for await (const message of client.fetch(recentSeq, {
        envelope: true,
        source: false,
        bodyStructure: true,
        internalDate: true,
        uid: true
      })) {
        const envelope = message.envelope || {};
        const subject = envelope.subject || '(No Subject)';
        const fromList = envelope.from || [];
        const fromItem = fromList[0] || {};
        const senderEmail = (fromItem.address || '').toLowerCase().trim();
        const senderName = fromItem.name || senderEmail;
        const toList = envelope.to || [];
        const toItem = toList[0] || {};
        const toAddress = (toItem.address || config.user).toLowerCase().trim();

        // Skip messages sent by ourselves
        if (senderEmail === config.user.toLowerCase()) continue;

        // Unique message identifier for deduplication
        const messageIdHeader = (envelope.messageId || `${message.uid}@${imapHost}`).replace(/[<>]/g, '');
        const existing = db.prepare('SELECT id FROM replies WHERE gmail_message_id = ?').get(messageIdHeader);
        if (existing) continue;

        // MATCH STRATEGY 1: Recipient Email matching
        let matchedEmail = null;
        if (senderEmail) {
          matchedEmail = db.prepare(`
            SELECT id, batch_id, to_address 
            FROM emails 
            WHERE lower(to_address) = lower(?) AND (account_id = ? OR account_id IS NULL)
            ORDER BY rowid DESC LIMIT 1
          `).get(senderEmail, account ? account.id : null);
        }

        // MATCH STRATEGY 2: Cleaned Subject matching
        const cleanSub = subject.replace(/^(re:|fwd:|automatic reply:|out of office:|auto:|undeliverable:|delivery status notification:|\[external\]\s*)+/gi, '').trim().toLowerCase();
        if (!matchedEmail && cleanSub.length > 5) {
          matchedEmail = db.prepare(`
            SELECT id, batch_id, to_address 
            FROM emails 
            WHERE lower(subject) LIKE ? AND (account_id = ? OR account_id IS NULL)
            ORDER BY rowid DESC LIMIT 1
          `).get('%' + cleanSub + '%', account ? account.id : null);
        }

        // MATCH STRATEGY 3: Campaign batch subject matching
        let matchedBatchId = matchedEmail ? matchedEmail.batch_id : null;
        if (!matchedBatchId && cleanSub.length > 5) {
          const batchMatch = db.prepare(`
            SELECT id FROM batches 
            WHERE lower(subject) LIKE ? AND (account_id = ? OR account_id IS NULL)
            ORDER BY created_at DESC LIMIT 1
          `).get('%' + cleanSub + '%', account ? account.id : null);
          if (batchMatch) matchedBatchId = batchMatch.id;
        }

        // Is message campaign related or automatic reply?
        const isRelated = !!matchedEmail || !!matchedBatchId || 
          /automatic reply|out of office|undeliverable|delivery status|failure|re:|jolly clamp/i.test(subject);

        if (!isRelated) {
          continue; // Skip unrelated general mail
        }

        // Fetch body structure or snippet
        const snippet = subject;
        const receivedAt = parseDateToSqlite(envelope.date || message.internalDate);
        const replyId = crypto.randomUUID();

        // Download body text/html for this specific matched message
        let bodyText = '';
        let bodyHtml = '';
        try {
          const fullData = await client.download(message.uid, undefined, { uid: true });
          if (fullData && fullData.content) {
            const rawBody = fullData.content.toString('utf-8');
            bodyText = rawBody.slice(0, 5000);
            bodyHtml = `<div style="font-family:sans-serif;white-space:pre-wrap;">${bodyText}</div>`;
          }
        } catch (bodyErr) {
          bodyText = snippet;
        }

        db.prepare(`
          INSERT INTO replies (
            id, account_id, email_id, batch_id, thread_id, gmail_message_id,
            from_address, from_name, to_address, subject, snippet,
            body_text, body_html, received_at, is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(
          replyId,
          account ? account.id : 1,
          matchedEmail ? matchedEmail.id : null,
          matchedBatchId,
          messageIdHeader,
          messageIdHeader,
          senderEmail,
          senderName,
          toAddress,
          subject,
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
        console.log(`[IMAP Sync] Ingested reply from ${senderName || senderEmail} (${subject.slice(0, 35)}...)`);
      }
    } finally {
      lock.release();
    }

    await client.logout();

    const totalReplies = db.prepare('SELECT COUNT(*) as c FROM replies').get().c;
    return { success: true, newCount, totalReplies };
  } catch (err) {
    console.error('[IMAP Sync] Error:', err.message);
    try { await client.logout(); } catch (e) {}
    return { success: false, newCount, error: err.message };
  }
}

module.exports = {
  syncRepliesViaImap
};
