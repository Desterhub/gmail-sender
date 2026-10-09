const EventEmitter = require('events');
const db = require('../db');
const { sendGmailMessage } = require('./gmail');
const { sendSmtpMessage, getSmtpConfig } = require('./smtp');

class QueueManager extends EventEmitter {
  constructor() {
    super();
    // Map of batchId -> Set of express res objects (SSE connections)
    this.sseConnections = new Map();
    // Map of batchId -> Boolean (true if worker currently running)
    this.activeWorkers = new Map();
  }

  /**
   * Registers an SSE client response stream for a batch
   */
  addSSEConnection(batchId, res) {
    if (!this.sseConnections.has(batchId)) {
      this.sseConnections.set(batchId, new Set());
    }
    this.sseConnections.get(batchId).add(res);

    // Initial state push
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (batch) {
      this.sendSSE(res, 'init', batch);
    }

    res.on('close', () => {
      const connections = this.sseConnections.get(batchId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          this.sseConnections.delete(batchId);
        }
      }
    });
  }

  /**
   * Sends an SSE event to a specific response
   */
  sendSSE(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Broadcasts an SSE event to all connected clients for a batch
   */
  broadcast(batchId, event, data) {
    const connections = this.sseConnections.get(batchId);
    if (connections && connections.size > 0) {
      for (const res of connections) {
        try {
          this.sendSSE(res, event, data);
        } catch (err) {
          // Stream error or client disconnect
        }
      }
    }
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Interpolates variable placeholders like {{name}}, {{company}} in strings
   * Case-insensitive match, replaces missing variables with blank and logs warning
   */
  interpolate(text, variables = {}, recipientEmail = '') {
    if (!text) return '';
    const lookup = {};
    if (variables && typeof variables === 'object') {
      for (const [k, v] of Object.entries(variables)) {
        if (k) lookup[k.toLowerCase().trim()] = v;
      }
    }

    return text.replace(/\{\{\s*([\w.\-_]+)\s*\}\}/g, (match, key) => {
      const normalizedKey = key.toLowerCase().trim();
      if (lookup[normalizedKey] !== undefined && lookup[normalizedKey] !== null) {
        return String(lookup[normalizedKey]);
      }
      console.warn(`[Template Warning] Variable "{{${key}}}" not found for recipient "${recipientEmail || 'unknown'}". Substituting with blank.`);
      return '';
    });
  }

  /**
   * Starts processing queued emails for a batch
   * @param {string} batchId
   * @param {number} throttlePerMinute Emails per minute rate limit (default 20)
   */
  async processBatch(batchId, throttlePerMinute = 20) {
    if (this.activeWorkers.get(batchId)) {
      return; // Worker already executing this batch
    }

    this.activeWorkers.set(batchId, true);

    try {
      // Mark batch as sending
      db.prepare("UPDATE batches SET status = 'sending' WHERE id = ?").run(batchId);

      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
      if (!batch) {
        this.activeWorkers.delete(batchId);
        return;
      }

      // Fetch batch attachments
      const attachments = db.prepare('SELECT * FROM attachments WHERE batch_id = ?').all(batchId);

      // Delay between sends based on throttle
      const safeThrottle = Math.max(1, Math.min(throttlePerMinute, 120));
      const delayMs = Math.round(60000 / safeThrottle);

      // Query queued emails in order
      const pendingEmails = db.prepare(`
        SELECT * FROM emails 
        WHERE batch_id = ? AND status = 'queued'
        ORDER BY rowid ASC
      `).all(batchId);

      for (let i = 0; i < pendingEmails.length; i++) {
        const emailRecord = pendingEmails[i];

        // Send with retries (up to 3 attempts with exponential backoff)
        let success = false;
        let attempts = 0;
        let lastError = null;
        let messageId = null;
        let threadId = null;

        const targetAccountId = batch.account_id || emailRecord.account_id || null;
        const targetAccount = targetAccountId ? db.prepare('SELECT * FROM accounts WHERE id = ?').get(targetAccountId) : null;
        const smtpConfig = getSmtpConfig(targetAccountId);
        const useSmtp = (targetAccount && targetAccount.dispatch_mode === 'smtp' && smtpConfig) || (smtpConfig && (!targetAccount || targetAccount.provider === 'smtp' || !targetAccount.access_token));

        while (!success && attempts < 3) {
          attempts++;
          try {
            let sendResult;
            if (useSmtp) {
              sendResult = await sendSmtpMessage({
                accountId: targetAccountId,
                to: emailRecord.to_address,
                cc: emailRecord.cc,
                bcc: emailRecord.bcc,
                subject: emailRecord.subject,
                bodyHtml: emailRecord.body_html,
                bodyText: batch.body_text,
                attachments
              });
            } else {
              sendResult = await sendGmailMessage({
                accountId: targetAccountId,
                to: emailRecord.to_address,
                cc: emailRecord.cc,
                bcc: emailRecord.bcc,
                subject: emailRecord.subject,
                bodyHtml: emailRecord.body_html,
                bodyText: batch.body_text,
                attachments
              });
            }
            messageId = sendResult.messageId;
            threadId = sendResult.threadId;
            success = true;
          } catch (err) {
            lastError = err.message || 'Unknown sending error';
            // If it's an authentication error, retrying won't succeed until account is reconnected
            if (lastError.includes('invalid_grant') || lastError.includes('Please reconnect')) {
              break;
            }
            if (attempts < 3) {
              // Exponential backoff: 1000ms, then 2000ms
              const backoff = attempts * 1000;
              await this.sleep(backoff);
            }
          }
        }

        // Update database with outcome
        if (success) {
          db.prepare(`
            UPDATE emails 
            SET status = 'sent', gmail_message_id = ?, thread_id = ?, error_message = NULL, sent_at = datetime('now'), attempts = attempts + ?
            WHERE id = ?
          `).run(messageId, threadId, attempts, emailRecord.id);
        } else {
          db.prepare(`
            UPDATE emails 
            SET status = 'failed', error_message = ?, sent_at = datetime('now'), attempts = attempts + ?
            WHERE id = ?
          `).run(lastError, attempts, emailRecord.id);
        }

        // If credentials expired, halt remaining loop immediately so user can reconnect and resume
        if (!success && lastError && (lastError.includes('invalid_grant') || lastError.includes('Please reconnect'))) {
          console.warn(`[Queue] Pausing batch ${batchId} due to expired Gmail credentials.`);
          break;
        }

        // Re-sync exact counts from emails table
        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_count
          FROM emails WHERE batch_id = ?
        `).get(batchId);

        db.prepare('UPDATE batches SET sent_count = ?, failed_count = ? WHERE id = ?')
          .run(stats.sent_count || 0, stats.failed_count || 0, batchId);

        const progress = Math.round((((stats.sent_count || 0) + (stats.failed_count || 0)) / (stats.total || 1)) * 100);

        // Broadcast progress update
        this.broadcast(batchId, 'progress', {
          batchId,
          emailId: emailRecord.id,
          to: emailRecord.to_address,
          status: success ? 'sent' : 'failed',
          error: lastError,
          sentCount: stats.sent_count || 0,
          failedCount: stats.failed_count || 0,
          queuedCount: stats.queued_count || 0,
          total: stats.total || 0,
          progress
        });

        // Throttle interval between sends if more emails remain
        if (i < pendingEmails.length - 1) {
          await this.sleep(delayMs);
        }
      }

      // Check final batch status
      const finalStats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_count
        FROM emails WHERE batch_id = ?
      `).get(batchId);

      let finalStatus = 'completed';
      if ((finalStats.queued_count || 0) > 0) {
        finalStatus = (finalStats.sent_count || 0) > 0 ? 'partial' : 'queued';
      } else if ((finalStats.failed_count || 0) === (finalStats.total || 0) && (finalStats.total || 0) > 0) {
        finalStatus = 'failed';
      } else if ((finalStats.failed_count || 0) > 0) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'completed';
      }

      db.prepare('UPDATE batches SET status = ?, sent_count = ?, failed_count = ? WHERE id = ?')
        .run(finalStatus, finalStats.sent_count || 0, finalStats.failed_count || 0, batchId);

      this.broadcast(batchId, 'complete', {
        batchId,
        status: finalStatus,
        sentCount: finalStats.sent_count || 0,
        failedCount: finalStats.failed_count || 0,
        queuedCount: finalStats.queued_count || 0,
        total: finalStats.total || 0
      });

    } catch (criticalErr) {
      console.error(`Critical error in processBatch (${batchId}):`, criticalErr.message);
      db.prepare("UPDATE batches SET status = 'failed' WHERE id = ?").run(batchId);
      this.broadcast(batchId, 'error', {
        batchId,
        error: criticalErr.message
      });
    } finally {
      this.activeWorkers.delete(batchId);
    }
  }

  /**
   * Resends a single email (whether failed or queued)
   */
  async resendEmail(emailId) {
    const emailRecord = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
    if (!emailRecord) {
      throw new Error('Email record not found');
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(emailRecord.batch_id);
    const attachments = db.prepare('SELECT * FROM attachments WHERE batch_id = ?').all(emailRecord.batch_id);

    const targetAccountId = emailRecord.account_id || (batch ? batch.account_id : null) || null;
    const targetAccount = targetAccountId ? db.prepare('SELECT * FROM accounts WHERE id = ?').get(targetAccountId) : null;
    const smtpConfig = getSmtpConfig(targetAccountId);
    const useSmtp = (targetAccount && targetAccount.dispatch_mode === 'smtp' && smtpConfig) || (smtpConfig && (!targetAccount || targetAccount.provider === 'smtp' || !targetAccount.access_token));

    try {
      let sendResult;
      if (useSmtp) {
        sendResult = await sendSmtpMessage({
          accountId: targetAccountId,
          to: emailRecord.to_address,
          cc: emailRecord.cc,
          bcc: emailRecord.bcc,
          subject: emailRecord.subject,
          bodyHtml: emailRecord.body_html,
          bodyText: batch ? batch.body_text : '',
          attachments
        });
      } else {
        sendResult = await sendGmailMessage({
          accountId: targetAccountId,
          to: emailRecord.to_address,
          cc: emailRecord.cc,
          bcc: emailRecord.bcc,
          subject: emailRecord.subject,
          bodyHtml: emailRecord.body_html,
          bodyText: batch ? batch.body_text : '',
          attachments
        });
      }
      const { messageId, threadId } = sendResult;

      db.prepare(`
        UPDATE emails 
        SET status = 'sent', gmail_message_id = ?, thread_id = ?, error_message = NULL, sent_at = datetime('now'), attempts = attempts + 1
        WHERE id = ?
      `).run(messageId, threadId, emailId);

      // Re-sync batch aggregates
      if (batch) {
        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_count
          FROM emails WHERE batch_id = ?
        `).get(batch.id);

        let finalStatus = 'completed';
        if ((stats.queued_count || 0) > 0) {
          finalStatus = (stats.sent_count || 0) > 0 ? 'partial' : 'queued';
        } else if ((stats.failed_count || 0) > 0) {
          finalStatus = 'partial';
        }

        db.prepare('UPDATE batches SET sent_count = ?, failed_count = ?, status = ? WHERE id = ?')
          .run(stats.sent_count || 0, stats.failed_count || 0, finalStatus, batch.id);
      }

      return { success: true, messageId };
    } catch (err) {
      db.prepare(`
        UPDATE emails 
        SET status = 'failed', attempts = attempts + 1, error_message = ?, sent_at = datetime('now')
        WHERE id = ?
      `).run(err.message, emailId);

      if (batch) {
        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_count
          FROM emails WHERE batch_id = ?
        `).get(batch.id);

        let finalStatus = 'completed';
        if ((stats.queued_count || 0) > 0) {
          finalStatus = (stats.sent_count || 0) > 0 ? 'partial' : 'queued';
        } else if ((stats.failed_count || 0) > 0) {
          finalStatus = 'partial';
        }

        db.prepare('UPDATE batches SET sent_count = ?, failed_count = ?, status = ? WHERE id = ?')
          .run(stats.sent_count || 0, stats.failed_count || 0, finalStatus, batch.id);
      }
      throw err;
    }
  }
}

const queueManager = new QueueManager();
module.exports = queueManager;
