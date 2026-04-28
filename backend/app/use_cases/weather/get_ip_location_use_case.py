import ipaddress
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class IpLocationResult:
    latitude: float
    longitude: float
    city: str
    state: str


def _is_public_ip(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)
    except ValueError:
        return False


def _ipapi_co(ip: Optional[str]) -> Optional[IpLocationResult]:
    url = f"https://ipapi.co/{ip}/json/" if ip else "https://ipapi.co/json/"
    try:
        with httpx.Client(timeout=6.0) as client:
            r = client.get(url, headers={"User-Agent": "weather-risk-dashboard/1.0"})
            if r.status_code != 200:
                return None
            d = r.json()
            if d.get("error"):
                return None
            lat = d.get("latitude")
            lon = d.get("longitude")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                return None
            return IpLocationResult(
                latitude=float(lat),
                longitude=float(lon),
                city=str(d.get("city") or ""),
                state=str(d.get("region_code") or d.get("region") or ""),
            )
    except Exception:
        return None


def _freeipapi(ip: Optional[str]) -> Optional[IpLocationResult]:
    url = f"https://freeipapi.com/api/json/{ip}" if ip else "https://freeipapi.com/api/json"
    try:
        with httpx.Client(timeout=6.0) as client:
            r = client.get(url)
            if r.status_code != 200:
                return None
            d = r.json()
            lat = d.get("latitude")
            lon = d.get("longitude")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                return None
            return IpLocationResult(
                latitude=float(lat),
                longitude=float(lon),
                city=str(d.get("cityName") or ""),
                state=str(d.get("regionName") or ""),
            )
    except Exception:
        return None


class GetIpLocationUseCase:
    """Resolves user location by IP address from server side.

    Used as a final fallback when the browser's geolocation and browser-side IP APIs
    fail (HTTP origin, CORS blocks, mobile network filters, rate limits, etc.).
    Server-side calls bypass all browser-imposed restrictions.
    """

    def execute(self, client_ip: Optional[str]) -> IpLocationResult:
        ip = client_ip if _is_public_ip(client_ip) else None
        result = _ipapi_co(ip) or _freeipapi(ip)
        if result is None:
            raise RuntimeError("Não foi possível determinar localização via IP")
        return result
