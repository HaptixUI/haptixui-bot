import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'haptixui_bot_verify_token_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const BASE_WEBSITE_URL = 'https://haptixui.github.io/';
const PROFILE_URL = 'https://www.instagram.com/haptixui/';

// Dynamic Component Deep-Links for Every Reel
const COMPONENT_CATALOG = {
  // 1. Download Button (State Transition)
  'BUTTON': {
    key: 'BUTTON',
    name: 'Animated 3-Stage Download Button',
    buttonTitle: '⚡ Download Button',
    url: `${BASE_WEBSITE_URL}?id=download-button`
  },
  // 2. Add to Cart Truck Animation
  'CART': {
    key: 'CART',
    name: '3D Delivery Truck Cart Button',
    buttonTitle: '🛒 Cart Truck',
    url: `${BASE_WEBSITE_URL}?id=cart-button`
  },
  // 3. 3D Rotating Glowing Heart
  'HEART': {
    key: 'HEART',
    name: '3D Rotating Glowing Heart',
    buttonTitle: '❤️ 3D Heart',
    url: `${BASE_WEBSITE_URL}?id=heart-3d`
  },
  // 4. Sakura Fractal Tree
  'TREE': {
    key: 'TREE',
    name: 'Sakura Fractal Tree',
    buttonTitle: '🌸 Sakura Tree',
    url: `${BASE_WEBSITE_URL}?id=sakura-tree`
  },
  // 5. 3D DNA Double Helix
  'DNA': {
    key: 'DNA',
    name: '3D Interactive DNA Double Helix',
    buttonTitle: '🧬 3D DNA Helix',
    url: `${BASE_WEBSITE_URL}?id=dna-helix`
  },
  'HELIX': {
    key: 'DNA',
    name: '3D Interactive DNA Double Helix',
    buttonTitle: '🧬 3D DNA Helix',
    url: `${BASE_WEBSITE_URL}?id=dna-helix`
  },
  // 6. 3D Interactive Periodic Table (Latest Active Reel)
  'TABLE': {
    key: 'TABLE',
    name: '3D Interactive Periodic Table',
    buttonTitle: '🔗 Periodic Table',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
  },
  'PERIODIC': {
    key: 'TABLE',
    name: '3D Interactive Periodic Table',
    buttonTitle: '🔗 Periodic Table',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
  },
  // Default fallback when user comments "CODE" on latest reel
  'DEFAULT': {
    key: 'TABLE',
    name: '3D Interactive Periodic Table',
    buttonTitle: '🔗 Get Reel Code',
    url: `${BASE_WEBSITE_URL}periodic_table.html`
  }
};

// In-memory logs & state caches
const recentLogs = [];
const processedComments = new Set();
const userComponentCache = new Map(); // Maps user IGSID / commenterId -> componentKey
const mediaComponentCache = new Map(); // Maps reel mediaId -> component

function logEntry(type, message, data = null) {
  const entry = {
    time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }),
    type,
    message,
    data
  };
  recentLogs.unshift(entry);
  if (recentLogs.length > 100) recentLogs.pop();
  console.log(`[${entry.time}] [${type}] ${message}`, data ? JSON.stringify(data) : '');
}

// Helper to send API calls to Meta Graph API
async function sendInstagramMessage(bodyPayload) {
  if (!PAGE_ACCESS_TOKEN) {
    logEntry('WARN', 'PAGE_ACCESS_TOKEN not set, skipping API call');
    return { ok: false, error: 'No token' };
  }
  try {
    const res = await fetch(`https://graph.instagram.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    logEntry('ERROR', `Fetch error in sendInstagramMessage: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// STEP 1: Initial Private Reply to Comment on Reel
// -----------------------------------------------------------------------------
async function sendStep1InitialAccess(commentId, username, component) {
  const textMsg = `Hey @${username}! I'm so glad you're here - thanks a ton for stopping by 😊\n\nTap below and I'll send you the access in just a moment ✨`;

  // Try Quick Reply on Private Reply
  const payload = {
    recipient: { comment_id: commentId },
    message: {
      text: textMsg,
      quick_replies: [
        {
          content_type: 'text',
          title: 'Send me the access',
          payload: `GET_ACCESS:${component.key}`
        }
      ]
    }
  };

  const res = await sendInstagramMessage(payload);
  if (!res.ok) {
    logEntry('FALLBACK_STEP1', `Quick reply failed on comment_id, sending plain text prompt fallback...`);
    // Fallback: send text with the prompt
    await sendInstagramMessage({
      recipient: { comment_id: commentId },
      message: {
        text: `Hey @${username}! I'm so glad you're here - thanks a ton for stopping by 😊\n\nReply "Send me the access" below and I'll send you the links in just a moment ✨`
      }
    });
  } else {
    logEntry('STEP1_SENT', `Step 1 initial access button sent to @${username} for ${component.name}!`);
  }
}

// -----------------------------------------------------------------------------
// STEP 2: Follow-Gate Interactive Prompt (Visit Profile + I'm following ✅)
// -----------------------------------------------------------------------------
async function sendStep2FollowGate(senderId, componentKey) {
  const compKey = componentKey || 'DEFAULT';
  const component = COMPONENT_CATALOG[compKey] || COMPONENT_CATALOG.DEFAULT;

  const promptText = `Oops! Looks like you haven't followed me yet 👀\n\nIt would mean a lot if you could visit my profile and hit that follow button 👇`;

  // Button Template (Visit Profile + Postback "I'm following ✅")
  const buttonTemplatePayload = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: promptText,
          buttons: [
            {
              type: 'web_url',
              url: PROFILE_URL,
              title: 'Visit Profile'
            },
            {
              type: 'postback',
              title: "I'm following ✅",
              payload: `FOLLOW_CONFIRMED:${component.key}`
            }
          ]
        }
      },
      quick_replies: [
        {
          content_type: 'text',
          title: "I'm following ✅",
          payload: `FOLLOW_CONFIRMED:${component.key}`
        }
      ]
    }
  };

  const res = await sendInstagramMessage(buttonTemplatePayload);
  if (!res.ok) {
    logEntry('FALLBACK_STEP2', `Button template failed for step 2, sending text fallback with quick reply...`);
    await sendInstagramMessage({
      recipient: { id: senderId },
      message: {
        text: `Oops! Looks like you haven't followed me yet 👀\n\nPlease visit my profile (${PROFILE_URL}) and hit follow! Then tap below 👇`,
        quick_replies: [
          {
            content_type: 'text',
            title: "I'm following ✅",
            payload: `FOLLOW_CONFIRMED:${component.key}`
          }
        ]
      }
    });
  } else {
    logEntry('STEP2_SENT', `Step 2 follow-gate prompt sent to user ${senderId} for ${component.name}!`);
  }
}

// -----------------------------------------------------------------------------
// STEP 3: Final Delivery Links (EXACTLY 2 BUTTONS as requested by user)
// Button 1: Reel Component direct link
// Button 2: Website main catalog link
// -----------------------------------------------------------------------------
async function sendStep3FinalDelivery(senderId, componentKey) {
  const compKey = componentKey || 'DEFAULT';
  const component = COMPONENT_CATALOG[compKey] || COMPONENT_CATALOG.DEFAULT;

  const deliveryText = `Hi!\n\nGlad you commented 🙌 Here's the promised link ⬇️`;
  const reelBtnTitle = component.buttonTitle || '🔗 Get Reel Code';
  const websiteBtnTitle = '⚡ HaptixUI Website';

  // Button Template with EXACTLY 2 BUTTONS as specified:
  // 1. Reel component direct access link (Top button)
  // 2. Main website link (2nd button)
  const finalPayload = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: deliveryText,
          buttons: [
            {
              type: 'web_url',
              url: component.url,
              title: reelBtnTitle
            },
            {
              type: 'web_url',
              url: BASE_WEBSITE_URL,
              title: websiteBtnTitle
            }
          ]
        }
      }
    }
  };

  const res = await sendInstagramMessage(finalPayload);
  if (!res.ok) {
    logEntry('FALLBACK_STEP3', `Button template failed for step 3, sending formatted text links fallback...`);
    await sendInstagramMessage({
      recipient: { id: senderId },
      message: {
        text: `Hi!\n\nGlad you commented 🙌 Here are the promised links ⬇️\n\n1. ${reelBtnTitle}:\n👉 ${component.url}\n\n2. ${websiteBtnTitle}:\n👉 ${BASE_WEBSITE_URL}`
      }
    });
  } else {
    logEntry('STEP3_DELIVERED', `Step 3 (2 buttons: "${reelBtnTitle}" + "${websiteBtnTitle}") delivered successfully to user ${senderId} for ${component.name}!`);
  }
}

// -----------------------------------------------------------------------------
// Helper: Determine component from comment text or reel caption
// -----------------------------------------------------------------------------
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

  // 2. Check reel caption via Media ID if keyword wasn't explicit
  if (mediaId) {
    if (mediaComponentCache.has(mediaId)) {
      return mediaComponentCache.get(mediaId);
    }

    if (PAGE_ACCESS_TOKEN) {
      try {
        const res = await fetch(`https://graph.instagram.com/v20.0/${mediaId}?fields=caption&access_token=${PAGE_ACCESS_TOKEN}`);
        const data = await res.json();
        const caption = (data?.caption || '').toUpperCase();

        let matched = COMPONENT_CATALOG.TABLE; // Default to latest active reel
        if (caption.includes('TABLE') || caption.includes('PERIODIC')) {
          matched = COMPONENT_CATALOG.TABLE;
        } else if (caption.includes('TREE') || caption.includes('SAKURA') || caption.includes('FRACTAL')) {
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

  // 3. Default to current active reel
  return COMPONENT_CATALOG.TABLE;
}

// -----------------------------------------------------------------------------
// Webhook Endpoints
// -----------------------------------------------------------------------------

// 1. Root Health Check Dashboard
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: -apple-system, sans-serif; background: #07090e; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
      <h1 style="color: #38bdf8; font-size: 32px; margin-bottom: 12px;">⚡ HaptixUI Instagram Auto-DM Bot</h1>
      <p style="color: #4ade80; font-weight: 700; font-size: 18px; margin-bottom: 8px;">Status: ACTIVE &amp; LISTENING 🚀</p>
      <p style="color: #94a3b8; font-size: 15px; margin-bottom: 24px;">Follow-Gate 3-Step Interactive Button Funnel Ready</p>
      <p style="color: #94a3b8;">Live Catalog: <a href="${BASE_WEBSITE_URL}" target="_blank" style="color: #38bdf8;">${BASE_WEBSITE_URL}</a></p>
      <p><a href="/logs" style="color: #38bdf8; text-decoration: none; font-weight: 600;">View Live Webhook Logs ➔</a></p>
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

// 3. Webhook Verification Handshake
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

// 4. Main Webhook Handler (Comments on Reels + Direct Message Button Taps)
app.post('/webhook', async (req, res) => {
  // Acknowledge Meta immediately with 200 OK
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (!body || body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    // -------------------------------------------------------------------------
    // A) Comments on Reel Posts (Step 1 Trigger)
    // -------------------------------------------------------------------------
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

        // Ignore bot's own comments to prevent infinite loops
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
          userComponentCache.set(commenterId, component.key);

          logEntry('TRIGGER_MATCH', `Matched ${component.name} (${component.key}) for @${username}! Sending Step 1 DM...`);

          try {
            // Send Step 1: Initial DM with "Send me the access" interactive button
            await sendStep1InitialAccess(commentId, username, component);

            // Public comment reply
            await fetch(`https://graph.instagram.com/v20.0/${commentId}/replies?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `@${username} Check your DMs! Tap the access button below 📥✨`
              })
            }).catch(e => console.error('Public reply error:', e.message));

          } catch (err) {
            logEntry('EXCEPTION_STEP1', `Error in comment reply: ${err.message}`);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // B) Direct Messages & Interactive Button Taps (Step 2 & Step 3 Triggers)
    // -------------------------------------------------------------------------
    for (const msgEvent of entry.messaging || []) {
      const senderId = msgEvent.sender?.id;
      if (!senderId) continue;

      // Extract payload from postback or quick reply or direct message text
      const postbackPayload = msgEvent.postback?.payload || '';
      const quickReplyPayload = msgEvent.message?.quick_reply?.payload || '';
      const msgText = (msgEvent.message?.text || '').trim();
      const upperMsgText = msgText.toUpperCase();

      logEntry('DM_EVENT_RECEIVED', `From user ${senderId}: text="${msgText}", postback="${postbackPayload}", qr="${quickReplyPayload}"`);

      // 1. Resolve Component Key from payload or cached user state
      let componentKey = 'DEFAULT';
      if (postbackPayload.includes(':')) {
        componentKey = postbackPayload.split(':')[1];
      } else if (quickReplyPayload.includes(':')) {
        componentKey = quickReplyPayload.split(':')[1];
      } else if (userComponentCache.has(senderId)) {
        componentKey = userComponentCache.get(senderId);
      }
      userComponentCache.set(senderId, componentKey);

      // 2. Check for Step 3 Trigger: "I'm following ✅" / FOLLOW_CONFIRMED
      const isFollowConfirmedTrigger = postbackPayload.startsWith('FOLLOW_CONFIRMED') ||
                                       quickReplyPayload.startsWith('FOLLOW_CONFIRMED') ||
                                       upperMsgText.includes("I'M FOLLOWING") ||
                                       upperMsgText.includes("IM FOLLOWING") ||
                                       upperMsgText.includes("FOLLOWING") ||
                                       upperMsgText.includes("FOLLOWED") ||
                                       upperMsgText.includes("DONE");

      // 3. Check for Step 2 Trigger: "Send me the access" / GET_ACCESS
      const isGetAccessTrigger = postbackPayload.startsWith('GET_ACCESS') ||
                                 quickReplyPayload.startsWith('GET_ACCESS') ||
                                 upperMsgText.includes('SEND ME THE ACCESS') ||
                                 upperMsgText.includes('ACCESS') ||
                                 upperMsgText === 'SEND';

      if (isFollowConfirmedTrigger) {
        logEntry('FLOW_STEP3', `User ${senderId} tapped "I'm following"! Delivering 2 final buttons for ${componentKey}`);
        await sendStep3FinalDelivery(senderId, componentKey);
      } else if (isGetAccessTrigger) {
        logEntry('FLOW_STEP2', `User ${senderId} tapped "Send me the access"! Sending Step 2 Follow-Gate for ${componentKey}`);
        await sendStep2FollowGate(senderId, componentKey);
      } else {
        // Any other message from user: detect intent or guide them to Step 2
        const detected = await getComponentForComment(msgText, null);
        userComponentCache.set(senderId, detected.key);
        logEntry('FLOW_GUIDE', `Guiding user ${senderId} with Follow-Gate for ${detected.name}`);
        await sendStep2FollowGate(senderId, detected.key);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 HaptixUI Bot Server running on http://localhost:${PORT}`);
});
