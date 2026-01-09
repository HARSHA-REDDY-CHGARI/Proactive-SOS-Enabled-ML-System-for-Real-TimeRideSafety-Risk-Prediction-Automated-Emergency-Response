# 🚨 Proactive SOS-Enabled ML System for Real-Time Ride Safety, Risk Prediction, and Automated Emergency Response  
(RideGuard)

## 📌 Overview
Ride safety remains a major concern, especially for women and solo travelers. Traditional safety mechanisms rely heavily on **manual SOS activation**, which may not be possible during distress situations. **RideGuard** is a proactive, ML-powered ride safety system designed to continuously monitor passenger safety and automatically trigger emergency responses when unsafe conditions are detected.

The system integrates **real-time GPS tracking, proactive safety verification, route deviation detection, and machine-learning-based risk prediction** to identify threats early and reduce reliance on user intervention.

---

## 🎯 Key Features
- 🔐 Proactive safety verification using timed security-question checks  
- 📍 Real-time GPS tracking and live route monitoring  
- 🧠 ML-based ride risk prediction (**Low / Medium / High / Critical**)  
- 🚧 Instant route deviation detection  
- 🚨 Automated SOS alerts to trusted contacts and nearby police stations  
- 📊 User-friendly dashboard for live ride status and alerts  

---

## 🧠 Motivation
Incidents of harassment and unsafe ride experiences are increasing, and in many cases victims are unable to manually trigger SOS alerts due to panic, restraint, or loss of consciousness. RideGuard addresses this gap by introducing an **automated and intelligent safety system** that continuously verifies passenger safety and initiates emergency responses without requiring manual activation.

---

## 🛠 Tech Stack

### Frontend
- React.js  
- Firebase  
- Mapbox  
- Google Maps API  

### Backend
- Python  
- Flask  
- REST APIs  

### Machine Learning
- LightGBM  
- Risk classification using telemetry, weather, and route deviation features  
- Model accuracy: **96%**

### Other Tools
- Telegram Bot API  
- Git & GitHub  

---

## 🧠 System Architecture
1. Ride starts and live GPS tracking is initiated  
2. Periodic security questions verify passenger consciousness and identity  
3. ML model analyzes telemetry, weather, and route behavior  
4. Route deviations and missed responses increase risk score  
5. If risk exceeds threshold, SOS alerts are triggered automatically  
6. Live location is shared with emergency contacts and nearby police  

---

## 📸 Application Screenshots
> Screenshots of the RideGuard application interface.

### 🔐 User Signup
![Signup](screenshots/signup.jpeg)

### 👤 Profile Setup
![Profile Setup](screenshots/profilesetup.jpeg)

### 🚨 Alert & Emergency Notification
![Alert Message](screenshots/alertmessage.jpeg)

### 🗺 Live Ride Tracking & Risk Detection
![Ride Result](screenshots/result.jpeg)

---

## 🎥 Demo Video
> Click below to watch the RideGuard demo showcasing real-time tracking, ML risk prediction, and automated SOS alerts.

[▶ Watch Demo Video](screenshots/projectdemo.mp4)

---

## 🚀 How to Run the Project

### Backend
```bash
cd ml-backend
pip install -r requirements.txt
python app.py
### frontend
```bash
cd UI
npm install
npm run dev
