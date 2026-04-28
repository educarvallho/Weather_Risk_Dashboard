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
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city || "",
      state: d.region_code || d.region || "",
    };
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
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.cityName || "",
      state: d.regionName || "",
    };
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

    // resolved flag prevents double-execution between getCurrentPosition callbacks
    // and the hard JS timeout below.
    let resolved = false;

    const resolve = (next: GeolocationState) => {
      if (resolved) return;
      resolved = true;
      setState(next);
    };

    const runIpFallback = async () => {
      const loc = await ipGeolocation();
      if (loc) {
        resolve({ status: "success", ...loc, approximate: true });
      } else {
        resolve({ status: "error", message: "Não foi possível obter sua localização" });
      }
    };

    // Watchdog: fires after 15s if no path has resolved yet (city not determined).
    // The native getCurrentPosition has its own 10s timeout option, but it does NOT cover
    // the permission-prompt wait time, so the callback can hang indefinitely on blocked/ignored
    // prompts (HTTP origins on mobile, OS without GPS, dialog dismissed, etc.).
    // Giving 15s here lets the native 10s error callback fire first when it can; the watchdog
    // is the last-resort safety net that forces the IP fallback chain (ipapi.co → freeipapi.com)
    // and feeds lat/lon to the backend so the "Sua Localização" card gets populated.
    const hardTimer = setTimeout(runIpFallback, 15000);

    if (!navigator.geolocation) {
      clearTimeout(hardTimer);
      runIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(hardTimer);
        resolve({
          status: "success",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        clearTimeout(hardTimer);
        runIpFallback();
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );

    return () => {
      clearTimeout(hardTimer);
      resolved = true; // prevent setState on unmounted component
    };
  }, []);

  return state;
}
