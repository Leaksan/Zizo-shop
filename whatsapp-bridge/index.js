const express = require("express");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = process.env.BRIDGE_PORT || 3100;
const TOKEN = process.env.BRIDGE_TOKEN || "ma-boutique-secret";
const GROUP_INVITE = process.env.GROUP_INVITE || "DVduTj41tTU5FcHjsvf9Rt";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});

let ready = false;
let groupChatId = null;

client.on("qr", (qr) => {
  console.log("\n=== PREMIERE CONNEXION : scannez ce QR code avec WhatsApp ===");
  console.log("(WhatsApp > Appareils connectes > Connecter un appareil)\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  ready = true;
  console.log("WhatsApp connecte.");
  try {
    const info = await client.getInviteInfo(GROUP_INVITE);
    groupChatId = info.id._serialized;
    console.log("Groupe cible :", info.subject, `(${groupChatId})`);
  } catch (e) {
    console.log("Groupe introuvable via le code d'invitation :", e.message);
    console.log("Verifiez que ce compte WhatsApp est membre du groupe.");
  }
});

client.on("disconnected", () => {
  ready = false;
  groupChatId = null;
  console.log("WhatsApp deconnecte.");
});

client.initialize();

const app = express();
app.use(express.json());

app.get("/status", (req, res) => {
  res.json({ ready, group: groupChatId });
});

app.post("/notify", async (req, res) => {
  if (req.body.token !== TOKEN) return res.status(403).json({ error: "Token invalide" });
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: "text requis" });
  if (!ready) return res.status(503).json({ error: "WhatsApp non connecte" });
  try {
    if (!groupChatId) {
      const info = await client.getInviteInfo(GROUP_INVITE);
      groupChatId = info.id._serialized;
    }
    await client.sendMessage(groupChatId, text);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Pont WhatsApp pret sur http://localhost:${PORT}`));
