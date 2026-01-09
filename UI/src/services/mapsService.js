// src/services/mapsService.js
// Helpers for interacting with Google Maps (client-side)
export const buildDirectionsRequest = (origin, destination) => ({
  origin,
  destination,
  travelMode: "DRIVING",
});

export async function getNearbyPlaces(map, location, type = "police", radius = 5000) {
  return new Promise((resolve, reject) => {
    if (!window.google?.maps?.places) return reject(new Error("Places library not loaded"));
    const service = new window.google.maps.places.PlacesService(map);
    const request = {
      location,
      radius,
      type,
    };
    service.nearbySearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) resolve(results);
      else reject(new Error("Places search failed: " + status));
    });
  });
}
// // src/services/mapsService.js
// // 🌍 RideGuard Free Map Service — OpenRouteService + OpenStreetMap (Overpass API)

// const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY; // Add your OpenRouteService key in .env

// /**
//  * Get driving directions between two coordinates using OpenRouteService
//  * @param {Object} origin - { lat, lng }
//  * @param {Object} destination - { lat, lng }
//  * @returns GeoJSON route coordinates
//  */
// export async function getDirections(origin, destination) {
//   try {
//     const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;
//     const res = await fetch(url);
//     const data = await res.json();

//     if (data?.features?.length > 0) {
//       const coords = data.features[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
//       return coords;
//     } else {
//       console.warn("No route found.");
//       return [];
//     }
//   } catch (err) {
//     console.error("Error fetching route:", err);
//     return [];
//   }
// }

// /**
//  * Find nearby police stations (or hospitals) using Overpass API (OpenStreetMap)
//  * @param {Object} location - { lat, lng }
//  * @param {string} type - "police" | "hospital" | "fire_station"
//  * @returns List of nearby locations
//  */
// export async function getNearbyPlaces(location, type = "police") {
//   try {
//     const radius = 3000; // meters (3 km range)
//     const query = `
//       [out:json];
//       node["amenity"="${type}"](around:${radius},${location.lat},${location.lng});
//       out;
//     `;
//     const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
//     const res = await fetch(url);
//     const data = await res.json();

//     if (data?.elements?.length > 0) {
//       return data.elements.map((el) => ({
//         id: el.id,
//         name: el.tags.name || `${type} station`,
//         lat: el.lat,
//         lng: el.lon,
//         address: el.tags.address || "Unknown",
//       }));
//     } else {
//       console.warn("No nearby places found.");
//       return [];
//     }
//   } catch (err) {
//     console.error("Error fetching nearby places:", err);
//     return [];
//   }
// }
