import React, { useState } from "react";
import { DirectionsService } from "@react-google-maps/api";

export default function RouteControls({ setDirections, getRiskPrediction }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const handleRoute = () => {
    const service = new window.google.maps.DirectionsService();
    service.route(
      { origin, destination, travelMode: "DRIVING" },
      (res, status) => {
        if (status === "OK") {
          setDirections(res);
          getRiskPrediction({
            distance: res.routes[0].legs[0].distance.value / 1000,
            duration: res.routes[0].legs[0].duration.value / 60,
          });
        } else {
          alert("Route not found!");
        }
      }
    );
  };

  return (
    <div>
      <h4>Plan Your Ride</h4>
      <input placeholder="Start Location" value={origin} onChange={(e) => setOrigin(e.target.value)} />
      <input placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
      <button className="primary mt-2" onClick={handleRoute}>Show Route & Predict Risk</button>
    </div>
  );
}
