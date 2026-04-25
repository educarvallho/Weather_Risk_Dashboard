import { MapPin, AlertCircle, Loader2 } from "lucide-react";
import { LocationWeather } from "@/types";
import { RiskBadge } from "@/components/ui/RiskBadge";

type Props =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: LocationWeather };

export function LocationWeatherCard(props: Props) {
  if (props.status === "loading") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Sua Localização</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Obtendo localização...
        </div>
      </div>
    );
  }

  if (props.status === "error") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Sua Localização</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {props.message}
        </div>
      </div>
    );
  }

  const { data } = props;
  return (
    <div className="bg-teal-50 rounded-xl border border-teal-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-teal-600" />
          <h3 className="font-semibold text-gray-900">Sua Localização</h3>
        </div>
        <RiskBadge level={data.current.risk.level} size="md" />
      </div>
      {data.nearest_city_name && (
        <p className="text-xs text-teal-700 mb-2">Próximo a: <strong>{data.nearest_city_name}</strong></p>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 text-xs">Temperatura</span>
          <p className="font-bold text-xl text-gray-900">{data.current.temperature.toFixed(1)}°C</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">Prob. Chuva</span>
          <p className="font-bold text-xl text-gray-900">{data.current.rain_probability}%</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">Vento</span>
          <p className="font-semibold text-gray-800">{data.current.wind_speed_kmh.toFixed(0)} km/h</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">Umidade</span>
          <p className="font-semibold text-gray-800">{data.current.humidity}%</p>
        </div>
      </div>
      {data.current.risk.reasons.length > 0 && (
        <div className="mt-3 text-xs text-teal-700">
          <strong>Fatores de risco:</strong> {data.current.risk.reasons.join(", ")}
        </div>
      )}
    </div>
  );
}
