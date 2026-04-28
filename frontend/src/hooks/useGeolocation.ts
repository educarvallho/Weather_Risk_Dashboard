"use client";

import { useState, useEffect } from "react";

type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number }
  | { status: "error"; message: string };

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ status: "error", message: "Geolocalização não suportada neste navegador" });
      return;
    }

    setState({ status: "loading" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "success",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Permissão de localização negada"
            : err.code === 2
            ? "Localização indisponível no momento"
            : "Não foi possível obter sua localização";
        setState({ status: "error", message: msg });
      },
      { timeout: 20000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  return state;
}
