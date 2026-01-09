const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// Telegram Webhook
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  const secret = functions.config().telegram.secret;

  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    console.error("Forbidden: Wrong secret");
    return res.sendStatus(403);
  }

  const token = functions.config().telegram.token;
  const message = req.body.message;

  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text || "";

  // /start
  if (text.startsWith("/start")) {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: "Welcome to RideGuard! 🚘\nSend /register YOUR_USER_ID",
    });
  }

  // /register userId
  if (text.startsWith("/register")) {
    const userId = text.split(" ")[1];
    if (!userId) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: "❌ Invalid format.\nUse: /register abc123",
      });
      return res.sendStatus(200);
    }

    await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("trusted_contacts")
      .doc(chatId.toString())
      .set({ chatId });

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `✅ Registered as trusted contact for user: ${userId}`,
    });

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

// Cloud Function to Send Alerts
exports.sendTelegramAlert = functions.https.onCall(async (data, context) => {
  const token = functions.config().telegram.token;
  const { userId, message } = data;

  const contacts = await admin.firestore()
    .collection("users")
    .doc(userId)
    .collection("trusted_contacts")
    .get();

  for (const doc of contacts.docs) {
    const chatId = doc.data().chatId;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });
  }

  return { success: true };
});
