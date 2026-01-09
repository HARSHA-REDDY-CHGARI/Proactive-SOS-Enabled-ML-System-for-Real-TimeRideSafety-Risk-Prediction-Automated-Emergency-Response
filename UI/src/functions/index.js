// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
const nodemailer = require("nodemailer");
admin.initializeApp();

const accountSid = functions.config().twilio?.sid;
const authToken = functions.config().twilio?.token;
const twilioFrom = functions.config().twilio?.from;
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().gmail?.user,
    pass: functions.config().gmail?.pass,
  },
});

exports.sendAlertSms = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { contacts, message } = data;
  const results = [];
  if (!client) return { success: false, error: "Twilio not configured" };
  for (const c of contacts) {
    try {
      const msg = await client.messages.create({ body: message, from: twilioFrom, to: c.phone });
      results.push({ to: c.phone, sid: msg.sid });
    } catch (err) {
      results.push({ to: c.phone, error: err.message });
    }
  }
  return { success: true, results };
});

exports.sendAlertEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { contacts, message } = data;
  const results = [];
  for (const c of contacts) {
    if (!c.email) { results.push({ to: c.email, error: "No email" }); continue; }
    try {
      const mailOptions = {
        from: `"RideGuard" <${functions.config().gmail?.user}>`,
        to: c.email,
        subject: "🚨 RideGuard Emergency Alert",
        text: message,
      };
      await mailTransport.sendMail(mailOptions);
      results.push({ to: c.email, status: "sent" });
    } catch (err) {
      results.push({ to: c.email, error: err.message });
    }
  }
  return { success: true, results };
});

exports.ping = functions.https.onRequest((req, res) => res.send("RideGuard Functions OK"));
