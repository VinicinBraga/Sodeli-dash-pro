import React, { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import FunnelView from "./components/FunnelView";
import { CRMView } from "./components/CRMView";
import Login from "./Pages/Login";

type Tab = "funnel" | "crm";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("funnel");
  const [isAuthed, setIsAuthed] = useState(false);

  // carrega se está logado
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setIsAuthed(!!token);
  }, []);

  function handleLogin() {
    setIsAuthed(true);
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    setIsAuthed(false);
  }

  // Se não tiver login, mostra a tela de login
  if (!isAuthed) {
    return <Login onLogin={handleLogin} />;
  }

  // Logado: mostra o dashboard normal
  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {/* Header da página (título/subtítulo) */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {activeTab === "funnel"
                ? "Performance de Marketing"
                : "Gestão de CRM"}
            </h1>
            <p className="mt-1 text-sm opacity-80">
              {activeTab === "funnel"
                ? "Acompanhe as principais métricas de conversão e investimento."
                : "Visualize suas vendas, oportunidades e base de leads."}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="h-9 px-3 rounded-md text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>

      {activeTab === "funnel" ? <FunnelView /> : <CRMView />}
    </Layout>
  );
}

export default App;
