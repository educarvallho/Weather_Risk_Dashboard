"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Settings, LogOut, CloudRain, SlidersHorizontal, GitCompareArrows } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const links = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/cities", icon: MapPin, label: "Cidades" },
    { href: "/compare", icon: GitCompareArrows, label: "Comparar" },
    ...(user?.role === "admin"
      ? [
          { href: "/admin/users", icon: Settings, label: "Usuários" },
          { href: "/admin/rules", icon: SlidersHorizontal, label: "Regras" },
        ]
      : []),
  ];

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-white fixed left-0 top-0 z-30">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <CloudRain className="h-7 w-7 text-teal-400" />
        <span className="font-bold text-lg leading-tight">Weather Risk<br /><span className="text-teal-400 text-sm font-normal">Dashboard</span></span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 px-4 py-4">
        <div className="mb-3 pb-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 mb-1.5">Desenvolvido por:</p>
          <Image
            src="/logo_nexoia.jpg"
            alt="NexoIA"
            width={100}
            height={32}
            className="rounded opacity-90"
            style={{ objectFit: "contain" }}
          />
        </div>
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-slate-700 rounded px-1.5 py-0.5 capitalize">{user?.role}</span>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
