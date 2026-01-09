
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";

import { auth, db } from "../services/firebase";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY || "";

// const OPENCAGE_KEY = import.meta.env.VITE_OPENCAGE_KEY || "";
// const BACKEND_BASE = import.meta.env.VITE_ML_API_BASE || "";
// const ML_PREDICT_PATH = import.meta.env.VITE_ML_API_PREDICT_ENDPOINT || "/predict";
// const ML_ALERT_PATH = import.meta.env.VITE_ML_API_ALERT_ENDPOINT || "/alert";
const PREDICT_BASE = import.meta.env.VITE_ML_API_PREDICT_BASE || "";
const ALERT_BASE = import.meta.env.VITE_ML_API_ALERT_BASE || "";

const ML_PREDICT_PATH = import.meta.env.VITE_ML_API_PREDICT_ENDPOINT || "/predict";
const ML_ALERT_PATH = import.meta.env.VITE_ML_API_ALERT_ENDPOINT || "/alert";


const toRad = (v) => (v * Math.PI) / 180;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distancePointToSegmentKm(lat, lon, lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return haversine(lat, lon, lat1, lon1);
  const x =
    (toRad(lon) - toRad(lon1)) *
    Math.cos(toRad((lat + lat1) / 2));
  const y = toRad(lat) - toRad(lat1);
  const x2 =
    (toRad(lon2) - toRad(lon1)) *
    Math.cos(toRad((lat2 + lat1) / 2));
  const y2 = toRad(lat2) - toRad(lat1);
  const dot = x * x2 + y * y2;
  const len2 = x2 * x2 + y2 * y2;
  let t = len2 === 0 ? 0 : dot / len2;
  t = Math.max(0, Math.min(1, t));
  const projLat = lat1 + t * (lat2 - lat1);
  const projLon = lon1 + t * (lon2 - lon1);
  return haversine(lat, lon, projLat, projLon);
}

export default function Dashboard() {
  // map
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  // user/profile
  const [userName, setUserName] = useState("Harsha");
  const [userProfile, setUserProfile] = useState({
    contacts: [],
    securityQuestions: [],
  });

  // local ui state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // route + police
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");
  const routeCoordsRef = useRef([]);
  const [policeStations, setPoliceStations] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // gps + marker
  const watchIdRef = useRef(null);
  const userMarkerRef = useRef(null);

  // security timer (secIntervalMins can be fractional for demo)
  const [secIntervalMins, setSecIntervalMins] = useState(2); // minutes (or 0.17 for 10s demo)
  const [securityOn, setSecurityOn] = useState(false);
  const [secRemaining, setSecRemaining] = useState(Math.round(secIntervalMins * 60));
  const secTimerIntervalRef = useRef(null);

  // security questions modal
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [currentQ, setCurrentQ] = useState(null);
  const [answerAttempt, setAnswerAttempt] = useState("");
  const questionTimerRef = useRef(null);

  // snack
  const [snack, setSnack] = useState(null);
  const snackRef = useRef(null);

  // deviation throttling
  const lastDeviationTs = useRef(0);

  // ------------------ profile fetch ------------------
  useEffect(() => {
    try {
      const u = auth.currentUser;
      if (u) {
        setUserName(u.displayName || u.email || "Harsha");
        fetchUserProfile(u.uid);
      } else {
        const id = setTimeout(() => {
          const uu = auth.currentUser;
          if (uu) {
            setUserName(uu.displayName || uu.email || "Harsha");
            fetchUserProfile(uu.uid);
          }
        }, 800);
        return () => clearTimeout(id);
      }
    } catch (e) {
      console.warn("profile init error", e);
    }
  }, []);

  async function fetchUserProfile(uid) {
    if (!uid) return;
    try {
      const dref = doc(db, "users", uid);
      const snap = await getDoc(dref);
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({
          contacts: Array.isArray(data.contacts) ? data.contacts : [],
          securityQuestions: Array.isArray(data.securityQuestions)
            ? data.securityQuestions
            : [],
        });
        // ensure remaining seconds reflect selected interval
        setSecRemaining(Math.round(secIntervalMins * 60));
      }
    } catch (e) {
      console.error("fetchUserProfile", e);
    }
  }

  // --------------- map init ----------------
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/navigation-day-v1",
        center: [78.9629, 20.5937],
        zoom: 6,
      });

      mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-left");

      mapRef.current.on("load", () => {
        if (!mapRef.current.getSource("route")) {
          mapRef.current.addSource("route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
          });
        }
        if (!mapRef.current.getLayer("route-line")) {
          mapRef.current.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#0066ff", "line-width": 6 },
          });
        }

        if (!mapRef.current.getSource("route-head")) {
          mapRef.current.addSource("route-head", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          mapRef.current.addLayer({
            id: "route-head",
            type: "circle",
            source: "route-head",
            paint: {
              "circle-radius": 8,
              "circle-color": "#fff",
              "circle-stroke-width": 3,
              "circle-stroke-color": "#0066ff",
            },
          });
        }
      });
    } catch (e) {
      console.error("map init", e);
      showSnack("Map failed to initialize (check token).");
    }

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------- helpers ---------------------
  function showSnack(msg, ms = 3000) {
    setSnack(msg);
    if (snackRef.current) clearTimeout(snackRef.current);
    snackRef.current = setTimeout(() => setSnack(null), ms);
  }

  function formatMMSS(sec) {
    if (typeof sec !== "number" || isNaN(sec)) return "00:00";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // ---------------- geocoding / route ----------------
  // async function geocodeOpenCage(q) {
  //   if (!OPENCAGE_KEY) return null;
  //   try {
  //     const res = await axios.get(
  //       `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${OPENCAGE_KEY}&limit=1`
  //     );
  //     if (res.data?.results?.length) {
  //       const g = res.data.results[0].geometry;
  //       return { lat: g.lat, lng: g.lng };
  //     }
  //   } catch (e) {}
  //   return null;
  // }

  // async function geocodeMapbox(q) {
  //   try {
  //     const tk = mapboxgl.accessToken;
  //     if (!tk) return null;
  //     const res = await axios.get(
  //       `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${tk}`
  //     );
  //     if (res.data?.features?.length) {
  //       const c = res.data.features[0].center;
  //       return { lng: c[0], lat: c[1] };
  //     }
  //   } catch (e) {}
  //   return null;
  // }

  // async function geocode(q) {
  //   if (!q) return null;
  //   const a = await geocodeOpenCage(q);
  //   if (a) return a;
  //   return await geocodeMapbox(q);
  // }

  // async function fetchRoute(sCoord, dCoord) {
  //   const coordsStr = `${sCoord.lng},${sCoord.lat};${dCoord.lng},${dCoord.lat}`;
  //   const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
  //   const r = await axios.get(url);
  //   if (!r.data || !r.data.routes || r.data.routes.length === 0) throw new Error("no-route");
  //   return r.data.routes[0].geometry;
  // }

  // async function fetchPolice(lat, lng) {
  //   try {
  //     const q = `
  //       [out:json][timeout:25];
  //       node(around:5000, ${lat}, ${lng})["amenity"="police"];
  //       out body;
  //     `;
  //     const r = await axios.post("https://overpass-api.de/api/interpreter", q, {
  //       headers: { "Content-Type": "text/plain" },
  //     });
  //     return r.data.elements || [];
  //   } catch (e) {
  //     return [];
  //   }
  // }

  // function setRouteOnMap(geometry) {
  //   try {
  //     if (!mapRef.current) return;
  //     const src = mapRef.current.getSource("route");
  //     if (src) src.setData({ type: "Feature", geometry });
  //     routeCoordsRef.current = (geometry.coordinates || []).map((c) => ({ lng: c[0], lat: c[1] }));

  //     const coords = geometry.coordinates || [];
  //     if (coords.length > 0) {
  //       const headSrc = mapRef.current.getSource("route-head");
  //       if (headSrc)
  //         headSrc.setData({
  //           type: "FeatureCollection",
  //           features: [{ type: "Feature", geometry: { type: "Point", coordinates: coords[0] } }],
  //         });
  //     }
  //   } catch (e) {
  //     console.error("setRouteOnMap", e);
  //   }
  // }

  // async function handleShowRoute() {
  //   if (!start || !destination) {
  //     showSnack("Enter both start and destination");
  //     return;
  //   }
  //   setLoadingRoute(true);
  //   try {
  //     const s = await geocode(start);
  //     const d = await geocode(destination);
  //     if (!s || !d) {
  //       showSnack("Geocode failed");
  //       setLoadingRoute(false);
  //       return;
  //     }

  //     const geometry = await fetchRoute(s, d);
  //     setRouteOnMap(geometry);

  //     const bounds = new mapboxgl.LngLatBounds();
  //     routeCoordsRef.current.forEach((p) => bounds.extend([p.lng, p.lat]));
  //     if (routeCoordsRef.current.length) mapRef.current.fitBounds(bounds, { padding: 80 });

  //     const police = await fetchPolice(s.lat, s.lng);
  //     setPoliceStations(police);

  //     showSnack("Route plotted");
  //   } catch (e) {
  //     console.error("handleShowRoute", e);
  //     showSnack("Failed to fetch route");
  //   } finally {
  //     setLoadingRoute(false);
  //   }
  // }
  // ---------------- GEOCODING (MAPBOX ONLY) ----------------
async function geocode(q) {
  try {
    if (!q) return null;

    const tk = mapboxgl.accessToken;
    if (!tk) {
      console.error("Mapbox token missing");
      return null;
    }

    const res = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${tk}`
    );

    if (res.data?.features?.length) {
      const c = res.data.features[0].center;
      return { lng: c[0], lat: c[1] };
    }
  } catch (e) {
    console.error("Mapbox geocode error:", e);
  }
  return null;
}


// ---------------- ROUTE FETCH (MAPBOX) ----------------
async function fetchRoute(sCoord, dCoord) {
  const coordsStr = `${sCoord.lng},${sCoord.lat};${dCoord.lng},${dCoord.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

  const r = await axios.get(url);
  if (!r.data || !r.data.routes || r.data.routes.length === 0)
    throw new Error("no-route");

  return r.data.routes[0].geometry;
}


// ---------------- POLICE STATIONS ----------------
async function fetchPolice(lat, lng) {
  try {
    const q = `
      [out:json][timeout:25];
      node(around:5000, ${lat}, ${lng})["amenity"="police"];
      out body;
    `;
    const r = await axios.post("https://overpass-api.de/api/interpreter", q, {
      headers: { "Content-Type": "text/plain" },
    });
    return r.data.elements || [];
  } catch (e) {
    console.error("police fetch error:", e);
    return [];
  }
}


// ---------------- SET ROUTE ON MAP ----------------
function setRouteOnMap(geometry) {
  try {
    if (!mapRef.current) return;

    const src = mapRef.current.getSource("route");
    if (src) {
      src.setData({ type: "Feature", geometry });
    }

    routeCoordsRef.current = (geometry.coordinates || []).map((c) => ({
      lng: c[0],
      lat: c[1],
    }));

    const coords = geometry.coordinates || [];
    if (coords.length > 0) {
      const headSrc = mapRef.current.getSource("route-head");
      if (headSrc) {
        headSrc.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: coords[0] },
            },
          ],
        });
      }
    }
  } catch (e) {
    console.error("setRouteOnMap error:", e);
  }
}


// ---------------- SHOW ROUTE ----------------
async function handleShowRoute() {
  if (!start || !destination) {
    showSnack("Enter both start and destination");
    return;
  }

  setLoadingRoute(true);

  try {
    const s = await geocode(start);
    const d = await geocode(destination);

    if (!s || !d) {
      showSnack("Geocode failed");
      setLoadingRoute(false);
      return;
    }

    const geometry = await fetchRoute(s, d);
    setRouteOnMap(geometry);

    const bounds = new mapboxgl.LngLatBounds();
    routeCoordsRef.current.forEach((p) =>
      bounds.extend([p.lng, p.lat])
    );

    if (routeCoordsRef.current.length)
      mapRef.current.fitBounds(bounds, { padding: 80 });

    const police = await fetchPolice(s.lat, s.lng);
    setPoliceStations(police);

    showSnack("Route plotted");
  } catch (e) {
    console.error("handleShowRoute error:", e);
    showSnack("Failed to fetch route");
  } finally {
    setLoadingRoute(false);
  }
}


  // // ---------------- risk predict (optional) ----------------
  // async function handlePredictRisk() {
  //   if (!routeCoordsRef.current || routeCoordsRef.current.length === 0) {
  //     showSnack("Plot route first");
  //     return;
  //   }
  //   const coords = routeCoordsRef.current;
  //   const startPt = coords[0];
  //   const endPt = coords[coords.length - 1];
  //   const distanceKm = haversine(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
  //   const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));

  //   const payload = {
  //     distance_km: +distanceKm.toFixed(3),
  //     ride_duration_minutes: durationMin,
  //     driver_rating: 4.5,
  //     traffic_congestion_level: 5,
  //     weather_visibility_km: 10,
  //     num_police_stations_nearby: policeStations.length,
  //   };

  //   try {
  //     if (!BACKEND_BASE) {
  //       console.log("Predict payload:", payload);
  //       showSnack("No ML backend configured");
  //       return;
  //     }
  //     const res = await axios.post(`${BACKEND_BASE}${ML_PREDICT_PATH}`, payload);
  //     const risk = res.data?.risk_level;
  //     const map = { 0: "Low", 1: "Medium", 2: "High", 3: "Critical" };
  //     showSnack(`Risk: ${map[risk] ?? "Unknown"}`, 5000);
  //   } catch (e) {
  //     console.error("predict error", e);
  //     showSnack("Prediction failed");
  //   }
  // }
 async function handlePredictRisk() { 
  if (!routeCoordsRef.current || routeCoordsRef.current.length === 0) {
    showSnack("Plot route first");
    return;
  }

  const coords = routeCoordsRef.current;
  const startPt = coords[0];
  const endPt = coords[coords.length - 1];

  const distanceKm = haversine(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
  const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));

  const hour = new Date().getHours();

  // ---- ML MODEL FEATURES EXACTLY AS TRAINED ----
  const payload = {
    security_checks_failed: 0,
    wrong_answer_count: 0,
    user_unresponsive_flag: 0,

    route_deviation_meters: 0,
    percent_route_deviated_segments: 0,

    avg_speed_kmph: 30,
    stops_count: 0,
    idle_time_sec: 0,

    police_stations_nearby: policeStations.length,
    nearest_police_distance_km: policeStations.length ? 1 : 5,

    trip_distance_km: Number(distanceKm.toFixed(3)),
    trip_duration_min: durationMin,
    time_since_trip_start: durationMin,

    is_night: hour >= 20 || hour < 6 ? 1 : 0,
    hour_of_day: hour,
    is_peak_hour: [8, 9, 18, 19].includes(hour) ? 1 : 0,

    traffic_density: 3,
    accident_zone_flag: 0,

    weather_temperature: 27,
    wind_speed_kmph: 5,
    weather_code: 1,
    rain_intensity: 0,
    visibility_km: 10,
    is_raining: 0,
    is_foggy: 0,
    is_storm: 0,

    user_alerts_sent: 0
  };

  try {
    // 🔥 USE THE NEW PREDICT BASE (5001)
    const predictBase = import.meta.env.VITE_ML_API_PREDICT_BASE;
    const predictEndpoint = import.meta.env.VITE_ML_API_PREDICT_ENDPOINT;

    // const res = await axios.post(`${predictBase}${predictEndpoint}`, payload);
    const res = await axios.post(`${PREDICT_BASE}${ML_PREDICT_PATH}`, payload);


    const predicted = res.data?.predicted_class || "Unknown";

    showSnack(`Risk Level: ${predicted}`, 5000);
  } catch (e) {
    console.error("predict error", e);
    showSnack("Prediction failed");
  }
}


  // ---------------- GPS tracking ----------------
  function startGPS() {
    if (!navigator.geolocation) {
      showSnack("Geolocation not supported");
      return;
    }
    if (watchIdRef.current) {
      showSnack("GPS already running");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!mapRef.current) return;

        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "30px";
          el.style.height = "30px";
          el.style.borderRadius = "50%";
          el.style.background = "#0b84ff";
          el.style.boxShadow = "0 6px 18px rgba(11,132,255,0.2)";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:white"></div>`;
          userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current);
        } else {
          userMarkerRef.current.setLngLat([lng, lat]);
        }

        fetchPolice(lat, lng).then((res) => {
          if (Array.isArray(res) && res.length) setPoliceStations(res);
        });

        checkDeviation(lat, lng);
      },
      (err) => {
        console.error("geo error", err);
        showSnack("GPS error");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );
    showSnack("GPS started");
  }

  // ---------------- NEAREST POLICE NAME ---------------
  function nearestPoliceName() {
    if (!policeStations || policeStations.length === 0) return null;
    return policeStations[0].tags?.name || null;
  }

  // ---------------- ALERT SENDER (central) -------------
  // async function sendAlert({ userId = null, lat = 0, lon = 0, message = "", extra = {} } = {}) {
  //   if (!BACKEND_BASE) {
  //     console.warn("No BACKEND_BASE configured; cannot send alert", { lat, lon, message });
  //     showSnack("Alert endpoint not configured");
  //     return false;
  //   }
  //   try {
  //     // Attempt to collect chat ids from profile contacts:
  //     // Support fields: chat_id, chatId, phone (phone used as fallback)
  //     const contactChatIds =
  //       Array.isArray(userProfile.contacts)
  //         ? userProfile.contacts
  //             .map((c) => c.chat_id || c.chatId || c.chatIdNumber || c.chat || null)
  //             .filter(Boolean)
  //         : [];

  //     // If contactChatIds empty but contacts have phone numbers we still forward phones to backend
  //     const phones =
  //       Array.isArray(userProfile.contacts)
  //         ? userProfile.contacts.map((c) => c.phone).filter(Boolean)
  //         : [];

  //     const payload = {
  //       userId,
  //       lat,
  //       lon,
  //       message,
  //       ts: new Date().toISOString(),
  //       contacts: contactChatIds, // backend should handle chat ids / phone fallback
  //       phones,
  //       police: nearestPoliceName(),
  //       ...extra,
  //     };

  //     await axios.post(`${BACKEND_BASE}${ML_ALERT_PATH}`, payload);
  //     return true;
  //   } catch (e) {
  //     console.error("sendAlert failed", e);
  //     return false;
  //   }
  // }
  // ---------------- ALERT SENDER (Separate Backend on Port 5000) -------------
async function sendAlert({
  userId = null,
  lat = 0,
  lon = 0,
  message = "",
  extra = {},
} = {}) {
  if (!ALERT_BASE) {
    showSnack("Alert server not configured");
    return false;
  }

  try {
    const contactChatIds = Array.isArray(userProfile.contacts)
      ? userProfile.contacts
          .map(c => c.chat_id || c.chatId || c.chatIdNumber || c.chat || null)
          .filter(Boolean)
      : [];

    const phones = Array.isArray(userProfile.contacts)
      ? userProfile.contacts.map(c => c.phone).filter(Boolean)
      : [];

    const payload = {
      userId,
      lat,
      lon,
      message,
      ts: new Date().toISOString(),
      contacts: contactChatIds,
      phones,
      police: nearestPoliceName(),
      ...extra,
    };

    await axios.post(`${ALERT_BASE}${ML_ALERT_PATH}`, payload);

    return true;
  } catch (e) {
    console.error("sendAlert failed", e);
    return false;
  }
}

  // ---------------- ROUTE DEVIATION CHECK --------------
  function checkDeviation(lat, lng) {
    const coords = routeCoordsRef.current;
    if (!coords || coords.length < 2) return;
    let minD = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const d = distancePointToSegmentKm(lat, lng, a.lat, a.lng, b.lat, b.lng);
      if (d < minD) minD = d;
    }
    if (minD > 0.2) {
      const now = Date.now();
      // throttle to once every 30s
      if (now - lastDeviationTs.current > 30000) {
        lastDeviationTs.current = now;
        const msg = `Route deviation detected (${Math.round(minD * 1000)} m)`;
        showSnack(msg);
        if (userMarkerRef.current) {
          const loc = userMarkerRef.current.getLngLat();
          sendAlert({
            userId: auth.currentUser?.uid || null,
            lat: loc.lat,
            lon: loc.lng,
            message: `Route deviation: ${Math.round(minD * 1000)} m`,
            extra: { deviation_m: Math.round(minD * 1000) },
          }).then((ok) => {
            if (!ok) showSnack("Route-deviation alert failed to send");
          });
        } else {
          sendAlert({
            userId: auth.currentUser?.uid || null,
            lat,
            lon,
            message: `Route deviation: ${Math.round(minD * 1000)} m`,
            extra: { deviation_m: Math.round(minD * 1000) },
          }).then((ok) => {
            if (!ok) showSnack("Route-deviation alert failed to send");
          });
        }
      }
    }
  }

  // ---------------- SECURITY QUESTION FLOW --------------
  async function fetchRandomQuestionAndOpen() {
    try {
      const questions = Array.isArray(userProfile.securityQuestions) ? userProfile.securityQuestions : [];
      if (!questions.length) {
        showSnack("No security questions configured in your profile");
        return;
      }
      const pick = questions[Math.floor(Math.random() * questions.length)];
      setCurrentQ(pick);
      setAnswerAttempt("");
      setQuestionModalOpen(true);

      // clear previous timer
      if (questionTimerRef.current) {
        clearTimeout(questionTimerRef.current);
        questionTimerRef.current = null;
      }

      // auto-fail after 15s
      questionTimerRef.current = setTimeout(() => {
        setQuestionModalOpen(false);
        handleSecurityFail(pick, null);
        questionTimerRef.current = null;
      }, 15000);
    } catch (e) {
      console.error("fetchRandomQuestionAndOpen", e);
    }
  }

  async function handleSecurityFail(q, attempt) {
    try {
      // log locally
      await addDoc(collection(db, "security_logs"), {
        userId: auth.currentUser?.uid || null,
        ts: new Date(),
        questionId: q?.id || null,
        question: q?.question || null,
        attempt: attempt || null,
        success: false,
        location: userMarkerRef.current ? userMarkerRef.current.getLngLat() : null,
      });
    } catch (e) {
      console.warn("failed to write security_logs", e);
    }

    showSnack("Security check failed — alerting contacts");

    const loc = userMarkerRef.current?.getLngLat();
    const ok = await sendAlert({
      userId: auth.currentUser?.uid || null,
      lat: loc?.lat || 0,
      lon: loc?.lng || 0,
      message: `Failed security check${q?.question ? ` — Q: ${q.question}` : ""}`,
      extra: { question: q?.question || null, attempt: attempt || null },
    });
    if (!ok) showSnack("Failed to send security alert");
  }

  async function submitSecurityAnswer() {
    if (!currentQ) return;
    // cancel timer
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    const attempt = (answerAttempt || "").trim().toLowerCase();
    const expected = (currentQ.answer || "").trim().toLowerCase();
    const ok = attempt === expected;
    setQuestionModalOpen(false);

    try {
      await addDoc(collection(db, "security_logs"), {
        userId: auth.currentUser?.uid || null,
        ts: new Date(),
        questionId: currentQ.id || null,
        question: currentQ.question || null,
        attempt,
        success: ok,
        location: userMarkerRef.current ? userMarkerRef.current.getLngLat() : null,
      });
    } catch (e) {
      console.warn("logging security answer failed", e);
    }

    if (!ok) {
      await handleSecurityFail(currentQ, attempt);
    } else {
      showSnack("Security check passed");
    }
  }

  // ----------------- Security controls (timer) -----------------
  // utility to convert minutes value (can be fractional) to seconds
  function intervalSecondsFromValue(val) {
    // val represents minutes (e.g., 2 means 2 minutes, 0.17 means ~10s)
    return Math.round(val * 60);
  }

  function startSecurity() {
    // set remaining based on chosen interval
    setSecurityOn(true);
    setSecRemaining(intervalSecondsFromValue(secIntervalMins));

    // clear previous timer
    if (secTimerIntervalRef.current) {
      clearInterval(secTimerIntervalRef.current);
      secTimerIntervalRef.current = null;
    }

    secTimerIntervalRef.current = setInterval(() => {
      setSecRemaining((s) => {
        const next = s - 1;
        if (next <= 0) {
          // trigger random question
          (async () => {
            try {
              await fetchRandomQuestionAndOpen();
            } catch (e) {
              console.error("fetchRandomQuestionAndOpen error", e);
            }
          })();
          // reset to full interval
          return intervalSecondsFromValue(secIntervalMins);
        }
        return next;
      });
    }, 1000);

    showSnack("Security started");
  }

  // pause only pauses the question system (does not reset remaining time)
  function pauseSecurity() {
    setSecurityOn(false);
    if (secTimerIntervalRef.current) {
      clearInterval(secTimerIntervalRef.current);
      secTimerIntervalRef.current = null;
    }
    showSnack("Security paused (questions paused)");
  }

  // ------------------ panic / imSafe ------------------
  async function panicSingle() {
    const loc = userMarkerRef.current?.getLngLat();
    if (!loc) {
      showSnack("No location available to send SOS");
      return;
    }
    try {
      const ok = await sendAlert({
        userId: auth.currentUser?.uid || null,
        lat: loc.lat,
        lon: loc.lng,
        message: "Panic: user triggered SOS",
      });
      if (ok) showSnack("SOS sent");
      else showSnack("SOS failed");
    } catch (e) {
      console.error("panic error", e);
      showSnack("SOS failed");
    }
  }

  async function imSafe() {
    try {
      await addDoc(collection(db, "security_logs"), {
        userId: auth.currentUser?.uid || null,
        ts: new Date(),
        type: "im_safe",
        location: userMarkerRef.current ? userMarkerRef.current.getLngLat() : null,
      });
      showSnack("Marked as safe");
    } catch (e) {
      showSnack("Failed to mark safe");
    }
  }

  // ---------------- cleanup ----------------
  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (secTimerIntervalRef.current) clearInterval(secTimerIntervalRef.current);
      if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
      if (snackRef.current) clearTimeout(snackRef.current);
    };
  }, []);

  // ---------------- UI ----------------
  return (
    <div style={{ padding: 20, boxSizing: "border-box", width: "100%" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <img
            src="https://cdn-icons-png.flaticon.com/512/2922/2922510.png"
            alt="profile"
            style={{ width: 64, height: 64, borderRadius: 999 }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{userName}</div>
            <div style={{ color: "#666", fontSize: 13 }}>Passenger</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }}>
          <select
            value={secIntervalMins}
            onChange={(e) => {
              // store numeric value
              setSecIntervalMins(Number(e.target.value));
              // if security running, also update remaining to new interval
              if (securityOn) setSecRemaining(intervalSecondsFromValue(Number(e.target.value)));
            }}
            style={{ padding: "8px 10px", borderRadius: 8 }}
          >
            <option value={0.17}>Every 10 seconds (Demo)</option>
            <option value={2}>Every 2 minutes</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes</option>
            <option value={30}>Every 30 minutes</option>
          </select>

          <button
            onClick={startSecurity}
            style={{
              background: "#0066ff",
              color: "#fff",
              border: "none",
              padding: "10px 14px",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            Start Security
          </button>

          <div
            style={{
              minWidth: 70,
              textAlign: "center",
              fontWeight: 700,
              background: securityOn ? "#111" : "#e9ecef",
              color: securityOn ? "#fff" : "#666",
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            {formatMMSS(secRemaining)}
          </div>

          {/* Settings icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              position: "relative",
            }}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            ⚙️
            {settingsOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "48px",
                  right: 0,
                  width: 200,
                  background: "#fff",
                  padding: 12,
                  borderRadius: 10,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                  zIndex: 999,
                }}
              >
                <button
                  onClick={() => {
                    pauseSecurity();
                    setSettingsOpen(false);
                  }}
                  style={{
                    background: "#ffcc00",
                    color: "#111",
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 700,
                  }}
                >
                  ⏸ Pause Security Check
                </button>

                <div style={{ height: 8 }} />

                <button
                  onClick={() => {
                    // Toggle demo quick run (just a convenience: set short interval)
                    setSecIntervalMins(0.17);
                    setSettingsOpen(false);
                    showSnack("Demo interval set to 10s");
                  }}
                  style={{
                    background: "#e9ecef",
                    color: "#333",
                    width: "100%",
                    padding: "8px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  ⚡ Quick Demo (10s)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={panicSingle}
            style={{
              background: "#ff3b30",
              color: "#fff",
              border: "none",
              padding: "10px 14px",
              borderRadius: 8,
            }}
          >
            🚨 Panic
          </button>
        </div>
      </div>

      {/* ROUTE INPUTS */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "#fff",
          padding: 14,
          borderRadius: 12,
          boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
          marginBottom: 12,
        }}
      >
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Start (city or address)"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #e6e6e6",
          }}
        />
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destination"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #e6e6e6",
          }}
        />
        <button
          onClick={handleShowRoute}
          disabled={loadingRoute}
          style={{
            background: "#0066ff",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            border: "none",
            fontWeight: 700,
          }}
        >
          {loadingRoute ? "Loading..." : "Show Route"}
        </button>
        <button
          onClick={handlePredictRisk}
          style={{
            background: "#0b8457",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            border: "none",
            fontWeight: 700,
          }}
        >
          Predict Risk
        </button>
      </div>

      {/* MAP + ACTIONS */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div
          style={{
            flex: 1,
            height: "65vh",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f7f9fb",
          }}
        >
          <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
        </div>

        <div
          style={{
            width: 320,
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Actions</h3>

          <button
            onClick={startGPS}
            style={{
              background: "#0066ff",
              color: "#fff",
              padding: 12,
              width: "100%",
              borderRadius: 8,
              border: "none",
              marginBottom: 8,
            }}
          >
            Start GPS
          </button>

          <div style={{ marginTop: 8 }}>
            <h4 style={{ margin: "6px 0" }}>Nearby Police</h4>
            {policeStations.length === 0 ? (
              <div style={{ color: "#666" }}>No police stations nearby</div>
            ) : (
              policeStations.map((p, i) => (
                <div
                  key={p.id || i}
                  style={{
                    padding: "8px 0",
                    borderBottom: i < policeStations.length - 1 ? "1px solid #f2f2f2" : "none",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.tags?.name || "Unnamed Station"}</div>
                  <div style={{ color: "#444", fontSize: 13 }}>{p.tags?.operator || p.tags?.addr_full || ""}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECURITY QUESTION MODAL */}
      {questionModalOpen && currentQ && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ width: 420, background: "#fff", padding: 18, borderRadius: 12 }}>
            <h3 style={{ marginTop: 0 }}>Security Check</h3>
            <p style={{ color: "#333" }}>{currentQ.question}</p>
            <input
              value={answerAttempt}
              onChange={(e) => setAnswerAttempt(e.target.value)}
              placeholder="Type your answer..."
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #eee", marginBottom: 12 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setQuestionModalOpen(false);
                  if (questionTimerRef.current) {
                    clearTimeout(questionTimerRef.current);
                    questionTimerRef.current = null;
                  }
                  handleSecurityFail(currentQ, null);
                }}
                style={{ padding: "8px 12px" }}
              >
                Dismiss
              </button>
              <button onClick={submitSecurityAnswer} style={{ background: "#007bff", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8 }}>
                Submit
              </button>
            </div>
            <div style={{ marginTop: 8, color: "#888", fontSize: 12 }}>Auto-fails in 15s if not answered.</div>
          </div>
        </div>
      )}

      {/* SNACK */}
      {snack && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 28,
            background: "#111",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            zIndex: 10000,
          }}
        >
          {snack}
        </div>
      )}
    </div>
  );
}
