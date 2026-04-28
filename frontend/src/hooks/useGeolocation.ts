"use client";

import { useState, useEffect } from "react";

type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number; approximate?: boolean }
  | { status: "error"; message: string };

async function ipGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch("https://freeipapi.com/api/json", {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      return { latitude: data.latitude, longitude: data.longitude };
    }
  } catch {}
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
        // Browser geolocation failed (permission denied or HTTP origin) — try IP fallback
        const loc = await ipGeolocation();
        if (loc) setState({ status: "success", ...loc, approximate: true });
        else setState({ status: "error", message: "Não foi possível obter sua localização" });
      },
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  return state;
}
