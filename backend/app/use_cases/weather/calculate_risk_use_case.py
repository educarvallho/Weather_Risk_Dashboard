from app.domain.entities.weather import RiskResult
from app.domain.enums import RiskLevel


class CalculateRiskUseCase:
    """
    Pure function — no I/O. Calculates operational risk based on weather parameters.

    Scoring rules:
      Rain probability > 70%  → +2  | > 40%  → +1
      Wind speed > 50 km/h   → +2  | > 30   → +1
      Temperature > 38°C or < 5°C → +2  | > 35 or < 10°C → +1
      Rain volume > 20 mm    → +1

    Classification: 0–2 = LOW | 3–4 = MEDIUM | 5+ = HIGH
    """

    def execute(
        self,
        temperature: float,
        rain_prob: float,
        wind_speed_kmh: float,
        rain_volume_mm: float,
    ) -> RiskResult:
        score = 0
        reasons: list[str] = []

        # Rain probability
        if rain_prob > 70:
            score += 2
            reasons.append(f"Prob. chuva alta ({rain_prob:.0f}%)")
        elif rain_prob > 40:
            score += 1
            reasons.append(f"Prob. chuva moderada ({rain_prob:.0f}%)")

        # Wind speed
        if wind_speed_kmh > 50:
            score += 2
            reasons.append(f"Vento perigoso ({wind_speed_kmh:.0f} km/h)")
        elif wind_speed_kmh > 30:
            score += 1
            reasons.append(f"Vento forte ({wind_speed_kmh:.0f} km/h)")

        # Temperature extremes
        if temperature > 38 or temperature < 5:
            score += 2
            reasons.append(f"Temperatura extrema ({temperature:.1f}°C)")
        elif temperature > 35 or temperature < 10:
            score += 1
            reasons.append(f"Temperatura elevada/baixa ({temperature:.1f}°C)")

        # Rain volume
        if rain_volume_mm > 20:
            score += 1
            reasons.append(f"Volume de chuva alto ({rain_volume_mm:.1f} mm)")

        if score >= 5:
            level = RiskLevel.HIGH
        elif score >= 3:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW

        return RiskResult(score=score, level=level, reasons=reasons)
