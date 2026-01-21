import React, { useEffect, useState } from "react";
import { ThemeProvider } from "../theme/ThemeContext";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  LogOut,
  Moon,
  Menu,
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
  const THEME_KEY = "sodeli_theme_v1";
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const html = document.documentElement;

    // aplica imediatamente
    html.classList.toggle("dark", darkMode);

    // e blinda contra qualquer coisa que tente mudar depois
    const id = window.setInterval(() => {
      const shouldBeDark = darkMode;
      const isDarkNow = html.classList.contains("dark");

      if (shouldBeDark !== isDarkNow) {
        html.classList.toggle("dark", shouldBeDark);
      }
    }, 200); // 200ms é leve e resolve o "pós-load"

    return () => window.clearInterval(id);
  }, [darkMode]);

  function toggleTheme() {
    const willBeDark = !darkMode;
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ThemeProvider value={{ darkMode }}>
      <div
        className={cn("min-h-screen transition-colors duration-200", shellBg)}
      >
        {/* ================= HEADER ================= */}
        <header
          className={cn(
            "h-28 fixed top-0 w-full z-50 flex items-center justify-between px-8 shadow-sm border-b transition-colors",
            headerBg
          )}
        >
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden mr-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img
              src={sodeliLogo}
              alt="Grupo Sodéli"
              className="h-16 w-auto object-contain"
            />

            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold tracking-tight text-base sm:text-xl truncate">
                Grupo Sodéli
              </span>
              <span className={cn("text-xs sm:text-sm truncate", subText)}>
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
        {/* ===== MOBILE SIDEBAR (DRAWER) ===== */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileSidebarOpen(false)}
            />

            {/* drawer */}
            <div
              className={cn(
                "absolute top-0 left-0 h-full w-72 shadow-xl border-r transition-colors",
                sidebarBg
              )}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                    )}
                    aria-label="Fechar menu"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs font-semibold text-gray-400 uppercase mb-4 tracking-wider">
                  Dashboards
                </p>

                <nav className="space-y-1">
                  <button
                    onClick={() => {
                      onTabChange("funnel");
                      setMobileSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      activeTab === "funnel"
                        ? darkMode
                          ? "bg-red-500/10 text-[#F4002B]"
                          : "bg-red-50 text-[#F4002B]"
                        : cn(
                            darkMode ? "text-gray-300" : "text-gray-600",
                            hoverItem
                          )
                    )}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Funil de Marketing
                  </button>

                  <button
                    onClick={() => {
                      onTabChange("crm");
                      setMobileSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      activeTab === "crm"
                        ? darkMode
                          ? "bg-red-500/10 text-[#F4002B]"
                          : "bg-red-50 text-[#F4002B]"
                        : cn(
                            darkMode ? "text-gray-300" : "text-gray-600",
                            hoverItem
                          )
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
            </div>
          </div>
        )}

        {/* ================= SIDEBAR ================= */}
        <aside
          className={cn(
            "hidden md:block w-64 fixed top-28 bottom-0 left-0 overflow-y-auto z-40 border-r transition-colors",
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
                    : cn(
                        darkMode ? "text-gray-300" : "text-gray-600",
                        hoverItem
                      )
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
                    : cn(
                        darkMode ? "text-gray-300" : "text-gray-600",
                        hoverItem
                      )
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
            "app-main md:ml-64 mt-28 px-6 py-6 min-h-[calc(100vh-7rem)] transition-colors",
            mainBg
          )}
        >
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </ThemeProvider>
  );
};
