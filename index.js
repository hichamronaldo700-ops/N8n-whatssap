/**
 * WhatsApp AI Service
 * -------------------
 * - Connects to WhatsApp Web (whatsapp-web.js)
 * - Forwards every incoming message to your n8n webhook (so n8n + AI can process it)
 * - Exposes a /send endpoint so n8n can send the AI's reply back through WhatsApp
 * - Exposes a /qr endpoint so you can scan the QR code from your browser (no terminal needed on Railway)
 *
 * ENV VARS (set these in Railway > Variables):
 *   N8N_WEBHOOK_URL   -> the n8n webhook URL that should receive incoming WhatsApp messages
 *   AUTH_TOKEN         -> a secret string you choose, used to protect the /send endpoint
 *   PORT                -> Railway sets this automatically, don't worry about it
 */

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "change-me";

let latestQr = null;
let isReady = false;

// ---- WhatsApp Client Setup ----
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "ai-vegita" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  latestQr = qr;
  isReady = false;
  console.log("New QR code received. Visit /qr in your browser to scan it.");
  qrcode.generate(qr, { small: true }); // also prints to Railway logs
});

client.on("ready", () => {
  isReady = true;
  latestQr = null;
  console.log("✅ WhatsApp client is ready and connected!");
});

client.on("disconnected", (reason) => {
  isReady = false;
  console.log("⚠️ WhatsApp client disconnected:", reason);
});

// Forward every incoming message to n8n
client.on("message", async (msg) => {
  if (msg.fromMe) return; // ignore messages sent by ourselves

  console.log(`📩 Message from ${msg.from}: ${msg.body}`);

  if (!N8N_WEBHOOK_URL) {
    console.log("⚠️ N8N_WEBHOOK_URL not set, skipping forward.");
    return;
  }

  try {
    await axios.post(N8N_WEBHOOK_URL, {
      from: msg.from,
      body: msg.body,
      timestamp: msg.timestamp,
      contactName: msg._data?.notifyName || null,
    });
  } catch (err) {
    console.error("❌ Failed to forward message to n8n:", err.message);
  }
});

client.initialize();

// ---- Simple auth middleware for protected routes ----
function requireAuth(req, res, next) {
  const token = req.headers["x-auth-token"];
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---- Routes ----

// Health check
app.get("/", (req, res) => {
  res.json({ status: "running", whatsappReady: isReady });
});

// View QR code in browser (no terminal needed)
app.get("/qr", async (req, res) => {
  if (isReady) {
    return res.send("<h2>✅ WhatsApp is already connected. No QR needed.</h2>");
  }
  if (!latestQr) {
    return res.send("<h2>⏳ Waiting for QR code... refresh in a few seconds.</h2>");
  }
  try {
    const qrImage = await QRCode.toDataURL(latestQr);
    res.send(`
      <html>
        <body style="text-align:center; font-family: sans-serif;">
          <h2>Scan this QR code with WhatsApp</h2>
          <img src="${qrImage}" style="width:300px;height:300px;" />
          <p>Open WhatsApp on your phone > Linked Devices > Link a Device</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Error generating QR image: " + err.message);
  }
});

// n8n calls this endpoint to send a message through WhatsApp
app.post("/send", requireAuth, async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Missing 'to' or 'message' field" });
  }
  if (!isReady) {
    return res.status(503).json({ error: "WhatsApp client not ready yet" });
  }

  try {
    // 'to' should be in format: '212600000000@c.us'
    await client.sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to send message:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
