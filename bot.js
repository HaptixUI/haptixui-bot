import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'haptixui_bot_verify_token_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const BASE_WEBSITE_URL = 'https://haptixui.github.io/';

// Dynamic Component Deep-Links for Every Reel
const COMPONENT_CATALOG = {
  // 1. Download Button (State Transition)
  'BUTTON': {
    name: 'Animated 3-Stage Download Button',
    url: `${BASE_WEBSITE_URL}?id=download-button`
  },
  // 2. Add to Cart Truck Animation
  'CART': {
    name: '3D Delivery Truck Cart Button',
    url: `${BASE_WEBSITE_URL}?id=cart-button`
  },
  // 3. 3D Rotating Glowing Heart
  'HEART': {
    name: '3D Rotating Glowing Heart',
    url: `${BASE_WEBSITE_URL}?id=heart-3d`
  },
  // 4. Sakura Fractal Tree
  'TREE': {
    name: 'Sakura Fractal Tree',
    url: `${BASE_WEBSITE_URL}?id=sakura-tree`
  },
  // 5. 3D DNA Double Helix
  'DNA': {
    name: '3D Interactive DNA Double Helix',
    url: `${BASE_WEBSITE_URL}?id=dna-helix`
  },
  'HELIX': {
    name: '3D Interactive DNA Double Helix',
    url: `${BASE_WEBSITE_URL}?id=dna-helix`
  },
  // 6. 3D Interactive Periodic Table
  'TABLE': {
    name: '3D Interactive Periodic Table',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
  },
  'PERIODIC': {
    name: '3D Interactive Periodic Table',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
  },
  // Default fallback when user comments "CODE" on latest reel
  'DEFAULT': {
    name: '3D Interactive Periodic Table',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
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

  if (mode === 'subscribe' && (token === VERIFY_TOKEN || token === 'motionui_bot_verify_token_2026' || token === 'haptixui_bot_verify_token_2026')) {
    logEntry('HANDSHAKE_SUCCESS', 'Meta challenge verified with 200 OK');
    return res.status(200).send(challenge);
  }

  logEntry('HANDSHAKE_FAILED', 'Token mismatch or invalid mode');
  res.sendStatus(403);
});

// Cache mapping mediaId -> component
const mediaComponentCache = new Map();

// Helper to determine exactly which component link to send based on comment & reel media
async function getComponentForComment(text, mediaId) {
  const upper = text.toUpperCase();

  // 1. Direct Keyword in user's comment
  if (upper.includes('TABLE') || upper.includes('PERIODIC') || upper.includes('ELEMENT') || upper.includes('SPHERE')) {
    return COMPONENT_CATALOG.TABLE;
  }
  if (upper.includes('TREE') || upper.includes('SAKURA') || upper.includes('FRACTAL') || upper.includes('BRANCH') || upper.includes('🌸') || upper.includes('🌲')) {
    return COMPONENT_CATALOG.TREE;
  }
  if (upper.includes('DNA') || upper.includes('HELIX') || upper.includes('🧬')) {
    return COMPONENT_CATALOG.DNA;
  }
  if (upper.includes('HEART') || upper.includes('LOVE') || upper.includes('ROMANTIC') || upper.includes('❤️')) {
    return COMPONENT_CATALOG.HEART;
  }
  if (upper.includes('CART') || upper.includes('TRUCK') || upper.includes('🛒') || upper.includes('🚚')) {
    return COMPONENT_CATALOG.CART;
  }
  if (upper.includes('BUTTON') || upper.includes('DOWNLOAD')) {
    return COMPONENT_CATALOG.BUTTON;
  }

  // 2. If user commented generic "CODE" or short comment, check reel caption via Media ID!
  if (mediaId) {
    if (mediaComponentCache.has(mediaId)) {
      return mediaComponentCache.get(mediaId);
    }

    if (PAGE_ACCESS_TOKEN) {
      try {
        const res = await fetch(`https://graph.instagram.com/v20.0/${mediaId}?fields=caption&access_token=${PAGE_ACCESS_TOKEN}`);
        const data = await res.json();
        const caption = (data?.caption || '').toUpperCase();

        let matched = COMPONENT_CATALOG.TREE; // Default to latest reel (Sakura Tree)
        if (caption.includes('TREE') || caption.includes('SAKURA') || caption.includes('FRACTAL')) {
          matched = COMPONENT_CATALOG.TREE;
        } else if (caption.includes('DNA') || caption.includes('HELIX')) {
          matched = COMPONENT_CATALOG.DNA;
        } else if (caption.includes('CART') || caption.includes('TRUCK')) {
          matched = COMPONENT_CATALOG.CART;
        } else if (caption.includes('BUTTON') || caption.includes('DOWNLOAD')) {
          matched = COMPONENT_CATALOG.BUTTON;
        } else if (caption.includes('HEART') || caption.includes('LOVE') || caption.includes('3D')) {
          matched = COMPONENT_CATALOG.HEART;
        }

        mediaComponentCache.set(mediaId, matched);
        return matched;
      } catch (err) {
        console.error('Could not fetch reel caption:', err.message);
      }
    }
  }

  // 3. Default to current active reel (Sakura Tree)
  return COMPONENT_CATALOG.TREE;
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
        const mediaId = comment?.media?.id;
        const text = (comment?.text || '').trim();
        const upperText = text.toUpperCase();
        const commenterId = comment?.from?.id;
        const username = comment?.from?.username || 'Dev';

        if (!commentId) continue;

        // Ignore bot's own comments to prevent recursive loops
        const isBotAccount = username.toLowerCase() === 'haptixui' || 
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

        logEntry('COMMENT_DETECTED', `Comment from @${username}: "${text}" (ID: ${commentId})`, { commenterId, commentId, mediaId });

        // Trigger if contains keywords OR is a short comment (1-6 words)
        const isKeyword = upperText.includes('TABLE') ||
                          upperText.includes('PERIODIC') ||
                          upperText.includes('ELEMENT') ||
                          upperText.includes('SPHERE') ||
                          upperText.includes('TREE') ||
                          upperText.includes('SAKURA') ||
                          upperText.includes('FRACTAL') ||
                          upperText.includes('BRANCH') ||
                          upperText.includes('DNA') ||
                          upperText.includes('HELIX') ||
                          upperText.includes('HEART') ||
                          upperText.includes('LOVE') ||
                          upperText.includes('ROMANTIC') ||
                          upperText.includes('CART') ||
                          upperText.includes('TRUCK') ||
                          upperText.includes('BUTTON') ||
                          upperText.includes('DOWNLOAD') ||
                          upperText.includes('CODE') ||
                          upperText.includes('LINK') ||
                          upperText.includes('SEND') ||
                          upperText.includes('SOURCE') ||
                          upperText.includes('PLEASE') ||
                          upperText.includes('PLS') ||
                          upperText.includes('WANT') ||
                          upperText.includes('GIVE') ||
                          upperText.includes('NEED') ||
                          upperText.includes('GET') ||
                          upperText.includes('HOW') ||
                          upperText.includes('🌸') ||
                          upperText.includes('🌲') ||
                          upperText.includes('🧬') ||
                          upperText.includes('❤️');

        const words = text.split(/\s+/).filter(Boolean);
        const isShortComment = words.length >= 1 && words.length <= 6;

        const isTrigger = isKeyword || isShortComment;

        if (isTrigger) {
          const component = await getComponentForComment(text, mediaId);
          logEntry('TRIGGER_MATCH', `Matched ${component.name} for @${username}! Sending Auto-DM...`);

          try {
            // A) Send Instagram Direct Message via Official Private Reply
            const dmResponse = await fetch(`https://graph.instagram.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
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
            const replyResponse = await fetch(`https://graph.instagram.com/v20.0/${commentId}/replies?access_token=${PAGE_ACCESS_TOKEN}`, {
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
