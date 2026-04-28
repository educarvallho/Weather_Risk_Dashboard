"use client";

import { useState, useEffect } from "react";

type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number; approximate?: boolean }
  | { status: "error"; message: string };

// Called from the browser — ipapi.co supports CORS, so the IP resolved is the client's IP,
// not the server's. This works correctly even when the server is in a different country.
async function ipGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.error && typeof data.latitude === "number" && typeof data.longitude === "number") {
      return { latitude: data.latitude, longitude: data.longitude };
    }
  } catch {
    // timeout or network error
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });

    if (!navigator.geolocation) {
      ipGeolocation().then((loc) => {
        if (loc) setState({ status: "success", ...loc, approximate: true });
        else setState({ status: "error", message: "Geolocalização não suportada neste navegador" });
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "success",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      async () => {
        // Browser geolocation unavailable (HTTP origin, permission denied, etc.)
        // Fall back to IP-based geolocation run client-side — gives the device's public IP location
        const loc = await ipGeolocation();
        if (loc) setState({ status: "success", ...loc, approximate: true });
        else setState({ status: "error", message: "Não foi possível obter sua localização" });
      },
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  return state;
}
