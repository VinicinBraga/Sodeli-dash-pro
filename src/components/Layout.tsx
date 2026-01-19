import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "../lib/utils";
import sodeliLogo from "../assets/MainLogo.png";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: "funnel" | "crm";
  onTabChange: (tab: "funnel" | "crm") => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const THEME_KEY = "theme";
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);

    // default explícito = light (evita gente "presa" em estados estranhos)
    const theme = saved === "dark" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, theme);

    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    setDarkMode(isDark);
  }, []);

  function toggleTheme() {
    const html = document.documentElement;
    const willBeDark = !html.classList.contains("dark");

    html.classList.toggle("dark", willBeDark);
    localStorage.setItem(THEME_KEY, willBeDark ? "dark" : "light");
    setDarkMode(willBeDark);
  }

  // ===== Paleta (centralizada aqui)
  const shellBg = darkMode
    ? "bg-[#0F0F0F] text-gray-100"
    : "bg-white text-gray-900";
  const headerBg = darkMode
    ? "bg-[#0F0F0F] border-gray-800"
    : "bg-white border-gray-200";
  const sidebarBg = darkMode
    ? "bg-[#0F0F0F] border-gray-800"
    : "bg-white border-[#E5E5E5]";
  const mainBg = darkMode ? "bg-[#121212]" : "bg-[#FAFAFA]";

  const subtleText = darkMode ? "text-gray-300" : "text-gray-600";
  const subText = darkMode ? "text-gray-400" : "text-gray-500";
  const hoverItem = darkMode
    ? "hover:bg-gray-800 hover:text-white"
    : "hover:bg-gray-50 hover:text-gray-900";

  const avatarBg = darkMode ? "bg-gray-800" : "bg-gray-100";
  const avatarIcon = darkMode ? "text-gray-300" : "text-gray-600";

  return (
    <div className={cn("min-h-screen transition-colors duration-200", shellBg)}>
      {/* ================= HEADER ================= */}
      <header
        className={cn(
          "h-28 fixed top-0 w-full z-50 flex items-center justify-between px-8 shadow-sm border-b transition-colors",
          headerBg
        )}
      >
        <div className="flex items-center gap-6">
          <img
            src={sodeliLogo}
            alt="Grupo Sodéli"
            className="h-16 w-auto object-contain"
          />

          <div className="flex flex-col leading-tight">
            <span className="text-xl font-semibold tracking-tight">
              Grupo Sodéli
            </span>
            <span className={cn("text-sm", subText)}>
              Monitoramento & Performance
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className={subtleText}>Admin</span>
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center",
              avatarBg
            )}
          >
            <Users className={cn("h-5 w-5", avatarIcon)} />
          </div>
        </div>
      </header>

      {/* ================= SIDEBAR ================= */}
      <aside
        className={cn(
          "w-64 fixed top-28 bottom-0 left-0 overflow-y-auto z-40 border-r transition-colors",
          sidebarBg
        )}
      >
        <div className="p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-4 tracking-wider">
            Dashboards
          </p>

          <nav className="space-y-1">
            <button
              onClick={() => onTabChange("funnel")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "funnel"
                  ? darkMode
                    ? "bg-red-500/10 text-[#F4002B]"
                    : "bg-red-50 text-[#F4002B]"
                  : cn(darkMode ? "text-gray-300" : "text-gray-600", hoverItem)
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Funil de Marketing
            </button>

            <button
              onClick={() => onTabChange("crm")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "crm"
                  ? darkMode
                    ? "bg-red-500/10 text-[#F4002B]"
                    : "bg-red-50 text-[#F4002B]"
                  : cn(darkMode ? "text-gray-300" : "text-gray-600", hoverItem)
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              CRM & Vendas
            </button>
          </nav>

          {/* ====== THEME TOGGLE ====== */}
          <p className="text-xs font-semibold text-gray-400 uppercase mb-4 mt-8 tracking-wider">
            Aparência
          </p>

          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              cn(darkMode ? "text-gray-300" : "text-gray-600", hoverItem)
            )}
          >
            {darkMode ? (
              <>
                <Sun className="h-4 w-4" />
                Modo claro
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                Modo escuro
              </>
            )}
          </button>

          <p className="text-xs font-semibold text-gray-400 uppercase mb-4 mt-8 tracking-wider">
            Conta
          </p>

          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              cn(darkMode ? "text-gray-300" : "text-gray-600", hoverItem)
            )}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main
        className={cn(
          "app-main ml-64 mt-28 px-6 py-6 min-h-[calc(100vh-7rem)] transition-colors",
          mainBg
        )}
      >
        <div className="max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
};
