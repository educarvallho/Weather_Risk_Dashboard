from fastapi import APIRouter, Depends, HTTPException, Query
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundException
from app.infrastructure.database.repositories.city_repository import CityRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.presentation.dependencies import get_city_repository, get_weather_client, get_current_user
from app.presentation.schemas.weather_schemas import CityForecastResponse, LocationWeatherResponse, CurrentWeatherOut, DailyForecastOut, RiskOut
from app.use_cases.weather.get_dashboard_data_use_case import GetDashboardDataUseCase
from app.use_cases.weather.get_city_forecast_use_case import GetCityForecastUseCase
from app.use_cases.weather.get_location_weather_use_case import GetLocationWeatherUseCase

router = APIRouter(prefix="/weather", tags=["weather"])


def _risk_out(risk) -> RiskOut:
    return RiskOut(score=risk.score, level=risk.level, reasons=risk.reasons)


def _current_out(current) -> CurrentWeatherOut:
    return CurrentWeatherOut(
        temperature=current.temperature,
        apparent_temperature=current.apparent_temperature,
        humidity=current.humidity,
        wind_speed_kmh=current.wind_speed_kmh,
        rain_probability=current.rain_probability,
        rain_volume_mm=current.rain_volume_mm,
        weather_code=current.weather_code,
        risk=_risk_out(current.risk),
    )


def _daily_out(daily) -> DailyForecastOut:
    return DailyForecastOut(
        date=daily.date,
        max_temp=daily.max_temp,
        min_temp=daily.min_temp,
        rain_probability=daily.rain_probability,
        rain_volume_mm=daily.rain_volume_mm,
        max_wind_speed_kmh=daily.max_wind_speed_kmh,
        weather_code=daily.weather_code,
        risk=_risk_out(daily.risk),
    )


@router.get("/dashboard")
def get_dashboard(
    city_repo: CityRepository = Depends(get_city_repository),
    weather_client: OpenMeteoClient = Depends(get_weather_client),
    _: User = Depends(get_current_user),
):
    try:
        return GetDashboardDataUseCase(city_repo, weather_client).execute()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao carregar dashboard: {str(e)}")


@router.get("/cities/{city_id}/forecast", response_model=CityForecastResponse)
def get_city_forecast(
    city_id: int,
    city_repo: CityRepository = Depends(get_city_repository),
    weather_client: OpenMeteoClient = Depends(get_weather_client),
    _: User = Depends(get_current_user),
):
    try:
        result = GetCityForecastUseCase(city_repo, weather_client).execute(city_id)
        return CityForecastResponse(
            city_id=result.city_id,
            city_name=result.city_name,
            state=result.state,
            current=_current_out(result.current),
            daily=[_daily_out(d) for d in result.daily],
        )
    except NotFoundException:
        raise HTTPException(status_code=404, detail="Cidade não encontrada")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao obter previsão: {str(e)}")


@router.get("/location", response_model=LocationWeatherResponse)
def get_location_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    city_repo: CityRepository = Depends(get_city_repository),
    weather_client: OpenMeteoClient = Depends(get_weather_client),
    _: User = Depends(get_current_user),
):
    try:
        result = GetLocationWeatherUseCase(city_repo, weather_client).execute(lat, lon)
        return LocationWeatherResponse(
            latitude=result.latitude,
            longitude=result.longitude,
            nearest_city_name=result.nearest_city_name,
            current=_current_out(result.current),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao obter clima da localização: {str(e)}")
