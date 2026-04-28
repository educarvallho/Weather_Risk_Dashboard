"use client";

import { useState, useEffect } from "react";

type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number; approximate?: boolean; city?: string; state?: string }
  | { status: "error"; message: string };

interface IPLocation {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryIpApi(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://ipapi.co/json/", 6000);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error || typeof d.latitude !== "number" || typeof d.longitude !== "number") return null;
    return { latitude: d.latitude, longitude: d.longitude, city: d.city || "", state: d.region_code || d.region || "" };
  } catch {
    return null;
  }
}

async function tryFreeIpApi(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://freeipapi.com/api/json", 6000);
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return null;
    return { latitude: d.latitude, longitude: d.longitude, city: d.cityName || "", state: d.regionName || "" };
  } catch {
    return null;
  }
}

async function ipGeolocation(): Promise<IPLocation | null> {
  const primary = await tryIpApi();
  if (primary) return primary;
  return tryFreeIpApi();
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
        // Browser geolocation unavailable — fallback to IP (ipapi.co → freeipapi.com)
        const loc = await ipGeolocation();
        if (loc) setState({ status: "success", ...loc, approximate: true });
        else setState({ status: "error", message: "Não foi possível obter sua localização" });
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  return state;
}
