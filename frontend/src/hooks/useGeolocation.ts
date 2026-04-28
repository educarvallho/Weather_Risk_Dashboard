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

// Chamadas via /geo-proxy/* — Next.js rewrite (next.config.js) faz o fetch externo
// server-side. Browser vê mesma origem → zero CORS.

async function tryIpApiCo(): Promise<IPLocation | null> {
  try {
    const res = await fetchWithTimeout("/geo-proxy/ipapi-co/json/", 8000);
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
    const res = await fetchWithTimeout("/geo-proxy/freeipapi/json", 8000);
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
      state: d.regionCode || d.regionName || "",
    };
  } catch (e) {
    log("freeipapi.com falhou", e);
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

async function ipGeolocation(): Promise<IPLocation | null> {
  // Tenta as duas APIs em sequência (rápido — proxy local).
  const a = await tryIpApiCo();
  if (a) {
    log("ipapi.co OK", a);
    return a;
  }
  const b = await tryFreeIpApi();
  if (b) {
    log("freeipapi.com OK", b);
    return b;
  }
  // Último recurso: backend tenta server-side (rede do container).
  log("ambas APIs browser falharam, tentando backend /weather/ip-locate");
  const c = await tryServerSide();
  if (c) {
    log("server-side OK", c);
    return c;
  }
  return null;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });

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

    // Watchdog: 15s. native getCurrentPosition tem timeout próprio (10s) mas não cobre
    // o tempo de espera do dialog de permissão; em HTTP/dispositivo sem GPS o callback
    // pode nunca disparar. O watchdog garante o fallback IP.
    const hardTimer = setTimeout(() => runIpFallback("watchdog 15s"), 15000);

    if (!navigator.geolocation) {
      clearTimeout(hardTimer);
      runIpFallback("navigator.geolocation indisponível");
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
