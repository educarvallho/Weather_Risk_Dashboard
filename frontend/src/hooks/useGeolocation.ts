"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

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

const log = (...args: unknown[]) => console.warn("[useGeolocation]", ...args);

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryIpApiCo(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://ipapi.co/json/", 6000);
    if (!res.ok) {
      log("ipapi.co status", res.status);
      return null;
    }
    const d = await res.json();
    if (d.error || typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("ipapi.co payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city || "",
      state: d.region_code || d.region || "",
    };
  } catch (e) {
    log("ipapi.co falhou", e);
    return null;
  }
}

async function tryFreeIpApi(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://freeipapi.com/api/json", 6000);
    if (!res.ok) {
      log("freeipapi.com status", res.status);
      return null;
    }
    const d = await res.json();
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("freeipapi.com payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.cityName || "",
      state: d.regionName || "",
    };
  } catch (e) {
    log("freeipapi.com falhou", e);
    return null;
  }
}

async function tryIpWhoIs(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("https://ipwho.is/", 6000);
    if (!res.ok) {
      log("ipwho.is status", res.status);
      return null;
    }
    const d = await res.json();
    if (!d.success || typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("ipwho.is payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city || "",
      state: d.region || "",
    };
  } catch (e) {
    log("ipwho.is falhou", e);
    return null;
  }
}

async function tryServerSide(): Promise<IPLocation | null> {
  try {
    const d = await api.get<{ latitude: number; longitude: number; city: string | null; state: string | null }>(
      "/weather/ip-locate",
    );
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") {
      log("server-side payload inválido", d);
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city || "",
      state: d.state || "",
    };
  } catch (e) {
    log("server-side falhou", e);
    return null;
  }
}

// Picks first non-null result from a list of promises (Promise.any-style, ignoring nulls).
async function firstResolved(promises: Promise<IPLocation | null>[]): Promise<IPLocation | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    if (pending === 0) {
      resolve(null);
      return;
    }
    let settled = false;
    promises.forEach((p) => {
      p.then((r) => {
        if (settled) return;
        if (r) {
          settled = true;
          resolve(r);
        } else {
          pending -= 1;
          if (pending === 0) resolve(null);
        }
      }).catch(() => {
        if (settled) return;
        pending -= 1;
        if (pending === 0) resolve(null);
      });
    });
  });
}

async function ipGeolocation(): Promise<IPLocation | null> {
  // Race three browser-side APIs in parallel — first valid response wins.
  const browserResult = await firstResolved([tryIpApiCo(), tryFreeIpApi(), tryIpWhoIs()]);
  if (browserResult) {
    log("browser-side IP fallback OK", browserResult);
    return browserResult;
  }
  // Last resort: server-side IP geolocation. Bypasses browser CORS, mixed-content,
  // mobile network filters, and rate-limit issues. The backend reads X-Forwarded-For
  // (or its own outbound IP via NAT) and queries ipapi.co/freeipapi.com server-side.
  log("todas as APIs browser-side falharam, tentando server-side");
  const serverResult = await tryServerSide();
  if (serverResult) {
    log("server-side IP fallback OK", serverResult);
    return serverResult;
  }
  log("server-side também falhou — sem localização disponível");
  return null;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });

    // resolved flag prevents double-execution between getCurrentPosition callbacks
    // and the watchdog below.
    let resolved = false;

    const resolve = (next: GeolocationState) => {
      if (resolved) return;
      resolved = true;
      setState(next);
    };

    const runIpFallback = async (reason: string) => {
      log("executando IP fallback —", reason);
      const loc = await ipGeolocation();
      if (loc) {
        resolve({ status: "success", ...loc, approximate: true });
      } else {
        resolve({ status: "error", message: "Não foi possível obter sua localização" });
      }
    };

    // Watchdog: fires after 15s if nothing has resolved. The native getCurrentPosition
    // has a 10s timeout option, but it does NOT cover the permission-prompt wait time —
    // on HTTP origins, blocked dialogs, or mobile devices without GPS, the callback can
    // hang indefinitely. The watchdog forces the IP fallback chain so the
    // "Sua Localização" card always gets populated.
    const hardTimer = setTimeout(() => runIpFallback("watchdog 15s"), 15000);

    if (!navigator.geolocation) {
      clearTimeout(hardTimer);
      runIpFallback("API geolocation indisponível");
      return;
    }

    log("solicitando navigator.geolocation.getCurrentPosition");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(hardTimer);
        log("GPS OK", pos.coords);
        resolve({
          status: "success",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        clearTimeout(hardTimer);
        log("GPS falhou", err.code, err.message);
        runIpFallback(`GPS error code=${err.code}`);
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );

    return () => {
      clearTimeout(hardTimer);
      resolved = true;
    };
  }, []);

  return state;
}
