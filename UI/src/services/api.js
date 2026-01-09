// src/services/api.js
const API_BASE = import.meta.env.VITE_ML_API_BASE || "http://127.0.0.1:5000";
const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION || ""; // optional

export async function predictRisk(features) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) throw new Error("Predict API error");
  return res.json();
}

// Cloud Functions callable variant can be done with firebase/functions in client code.
// For quick testing you may create an HTTP endpoint that triggers Twilio in functions.
export const API_BASE_URL = API_BASE;
export const FUNCTIONS_REGION_URL = FUNCTIONS_REGION;