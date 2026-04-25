"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { City } from "@/types";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  city: City | null;
  onClose: () => void;
  onSave: () => void;
}

export function CityFormModal({ city, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: city?.name || "",
    state: city?.state || "",
    country: city?.country || "Brasil",
    latitude: city?.latitude?.toString() || "",
    longitude: city?.longitude?.toString() || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) };
    try {
      if (city) {
        await api.put(`/cities/${city.id}`, body);
      } else {
        await api.post("/cities", body);
      }
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "name", label: "Nome", type: "text", placeholder: "São Paulo" },
    { key: "state", label: "Estado (UF)", type: "text", placeholder: "SP", maxLength: 2 },
    { key: "country", label: "País", type: "text", placeholder: "Brasil" },
    { key: "latitude", label: "Latitude", type: "number", placeholder: "-23.5505" },
    { key: "longitude", label: "Longitude", type: "number", placeholder: "-46.6333" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{city ? "Editar Cidade" : "Nova Cidade"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type}
                step={f.type === "number" ? "any" : undefined}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {saving ? <><Spinner size="sm" />Salvando...</> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
