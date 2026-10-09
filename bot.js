import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'motionui_bot_verify_token_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const BASE_WEBSITE_URL = 'https://haptixui.github.io/';

// Dynamic Component Deep-Links for Every Reel
const COMPONENT_CATALOG = {
  // 1. Download Button (Current Reel)
  'BUTTON': {
    name: 'Animated 3-Stage Download Button',
    url: `${BASE_WEBSITE_URL}?id=download-button`
  },
  // 2. Add to Cart Truck Animation
  'CART': {
    name: '3D Delivery Truck Cart Button',
    url: `${BASE_WEBSITE_URL}?id=cart-button`
  },
  // 3. Theme Toggle Switch
  'TOGGLE': {
    name: 'Celestial Day & Night Switch',
    url: `${BASE_WEBSITE_URL}?id=theme-toggle`
  },
  // 4. 3D Tilt Card
  'CARD': {
    name: '3D Holographic Tilt Card',
    url: `${BASE_WEBSITE_URL}?id=hologram-card`
  },
  // 5. Quantum Loader
  'LOADER': {
    name: 'Infinity Quantum Orbit Loader',
    url: `${BASE_WEBSITE_URL}?id=quantum-loader`
  },
  // Default fallback when user comments "CODE"
  'DEFAULT': {
    name: 'Animated 3-Stage Download Button',
    url: `${BASE_WEBSITE_URL}?id=download-button`
  }
};

// In-memory logs & caches
const recentLogs = [];
const processedComments = new Set();

function logEntry(type, message, data = null) {
  const entry = {
    time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }),
    type,
    message,
    data
  };
  recentLogs.unshift(entry);
  if (recentLogs.length > 80) recentLogs.pop();
  console.log(`[${entry.time}] [${type}] ${message}`, data ? JSON.stringify(data) : '');
}

// 1. Root Health Check
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; background: #0a0b10; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
      <h1 style="color: #38bdf8;">⚡ HaptixUI Instagram Auto-DM Bot</h1>
      <p style="color: #4ade80; font-weight: bold;">Status: ACTIVE &amp; LISTENING 🚀</p>
      <p style="color: #94a3b8;">Live Website Catalog: <a href="${BASE_WEBSITE_URL}" target="_blank" style="color: #38bdf8;">${BASE_WEBSITE_URL}</a></p>
      <p><a href="/logs" style="color: #38bdf8; text-decoration: none;">View Live Webhook Logs ➔</a></p>
    </div>
  `);
});

// 2. Live Logs Endpoint
app.get('/logs', (req, res) => {
  res.json({
    status: 'ACTIVE',
    live_website: BASE_WEBSITE_URL,
    total_comments_handled: processedComments.size,
    logs: recentLogs
  });
});

// 3. Webhook Verification (Handshake)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logEntry('HANDSHAKE', `Meta Webhook verification check received (token: ${token})`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logEntry('HANDSHAKE_SUCCESS', 'Meta challenge verified with 200 OK');
    return res.status(200).send(challenge);
  }

  logEntry('HANDSHAKE_FAILED', 'Token mismatch or invalid mode');
  res.sendStatus(403);
});

// Helper to determine which component link to send based on comment text
function getComponentForComment(text) {
  const upper = text.toUpperCase();
  if (upper.includes('CART') || upper.includes('TRUCK')) return COMPONENT_CATALOG.CART;
  if (upper.includes('TOGGLE') || upper.includes('SWITCH')) return COMPONENT_CATALOG.TOGGLE;
  if (upper.includes('CARD') || upper.includes('TILT')) return COMPONENT_CATALOG.CARD;
  if (upper.includes('LOADER') || upper.includes('ORBIT')) return COMPONENT_CATALOG.LOADER;
  return COMPONENT_CATALOG.DEFAULT;
}

// 4. Incoming Instagram Events (Comment on Reel / Post)
app.post('/webhook', async (req, res) => {
  // Acknowledge Meta immediately with 200 OK
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (!body || body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        const comment = change.value;
        const commentId = comment?.id;
        const text = (comment?.text || '').trim();
        const upperText = text.toUpperCase();
        const commenterId = comment?.from?.id;
        const username = comment?.from?.username || 'Dev';

        if (!commentId) continue;

        // Ignore bot's own comments to prevent recursive loops
        const isBotAccount = username.toLowerCase() === 'haptixui' || 
                             username.toLowerCase() === 'sachin.mandawi' || 
                             commenterId === '28293499653683727';
        if (isBotAccount) {
          console.log(`⏩ Ignoring bot's own comment from @${username}`);
          continue;
        }

        // Check if comment was already processed
        if (processedComments.has(commentId)) {
          console.log(`⏩ Skipping duplicate comment: ${commentId}`);
          continue;
        }
        processedComments.add(commentId);

        logEntry('COMMENT_DETECTED', `Comment from @${username}: "${text}" (ID: ${commentId})`, { commenterId, commentId });

        // Trigger if contains "CODE" or component keywords
        const isTrigger = upperText.includes('CODE') || 
                          upperText.includes('BUTTON') || 
                          upperText.includes('CART') || 
                          upperText.includes('TOGGLE') || 
                          upperText.includes('CARD') || 
                          upperText.includes('LOADER');

        if (isTrigger) {
          const component = getComponentForComment(text);
          logEntry('TRIGGER_MATCH', `Matched ${component.name} for @${username}! Sending Auto-DM...`);

          try {
            // A) Send Instagram Direct Message via Official Private Reply
            const dmResponse = await fetch(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: {
                  comment_id: commentId
                },
                message: {
                  text: `Hey @${username}! ⚡ Thanks for watching our HaptixUI reel.\n\nHere is the live interactive component & copy-paste source code for the ${component.name}:\n\n👉 ${component.url}\n\nPreview it live, test the micro-interaction, and copy pure HTML/CSS/JS with 1 click!`
                }
              })
            });

            const dmResult = await dmResponse.json();
            if (dmResult.error) {
              logEntry('DM_ERROR', `Meta API error sending DM: ${dmResult.error.message}`, dmResult.error);
            } else {
              logEntry('DM_SENT', `Direct Message sent successfully to @${username}!`, dmResult);
            }

            // B) Public Comment Reply (Only once, zero loops)
            const replyResponse = await fetch(`https://graph.instagram.com/v19.0/${commentId}/replies?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `@${username} Check your DMs! Sent you the live preview & source files 📥✨`
              })
            });

            const replyResult = await replyResponse.json();
            if (replyResult.error) {
              logEntry('REPLY_ERROR', `Meta API error replying to comment: ${replyResult.error.message}`, replyResult.error);
            } else {
              logEntry('REPLY_SENT', `Public comment reply posted successfully!`, replyResult);
            }

          } catch (err) {
            logEntry('EXCEPTION', `Error sending message: ${err.message}`);
          }
        }
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 HaptixUI Bot Server running on http://localhost:${PORT}`);
});
