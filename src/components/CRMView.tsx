import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Deal, Contact } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  UserCheck,
  Users,
  Trophy,
} from "lucide-react";

type TabType = "won" | "opportunity" | "qualified" | "contacts";

export const CRMView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("won");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCRMData = async () => {
    setLoading(true);
    try {
      if (activeTab === "contacts") {
        const rows = await api.getContacts();
        // filtro de busca local (simples)
        const filtered = rows.filter((c: any) => {
          const q = searchTerm.toLowerCase().trim();
          if (!q) return true;
          return (
            (c.name || "").toLowerCase().includes(q) ||
            (c.email || "").toLowerCase().includes(q)
          );
        });

        setData(filtered);
        setTotal(filtered.length);
      } else {
        const rows = await api.getDeals();

        // filtro por tipo de aba (local, baseado nos campos que existem no BQ)
        const typed = rows.filter((d: any) => {
          const stage = (d.deal_stage_name || "").toLowerCase();
          const won = d.win === true;

          if (activeTab === "won") return won;
          if (activeTab === "qualified") return stage.includes("qualific");
          if (activeTab === "opportunity")
            return !won && !stage.includes("perdid");
          return true;
        });

        // busca local
        const q = searchTerm.toLowerCase().trim();
        const filtered = typed.filter((d: any) => {
          if (!q) return true;
          return (
            (d.organization_name || "").toLowerCase().includes(q) ||
            (d.user_name || "").toLowerCase().includes(q) ||
            (d.email_negocia_o || "").toLowerCase().includes(q) ||
            (d.deal_source_name || d.canal_do_lead || "")
              .toLowerCase()
              .includes(q)
          );
        });

        setData(filtered);
        setTotal(filtered.length);
      }
    } catch (error) {
      console.error("Error fetching CRM data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1); // Reset page on tab/search change
  }, [activeTab, searchTerm]);

  useEffect(() => {
    fetchCRMData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, searchTerm]); // re-fetch when these change

  const renderPagination = () => (
    <div className="flex items-center justify-between px-2 py-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">
        Mostrando {(page - 1) * 10 + 1} a {Math.min(page * 10, total)} de{" "}
        {total} resultados
      </span>
      <div className="flex gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          disabled={page * 10 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: "won", label: "Vendas Realizadas", icon: Trophy },
    { id: "opportunity", label: "Oportunidades", icon: Briefcase },
    { id: "qualified", label: "Leads Qualificados", icon: UserCheck },
    { id: "contacts", label: "Base de Contatos", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou empresa..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                {activeTab === "contacts" ? (
                  <>
                    <th className="px-6 py-3 font-medium">Data Criação</th>
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Última Conversão</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3 font-medium">
                      {activeTab === "won" ? "Data Venda" : "Data Criação"}
                    </th>
                    <th className="px-6 py-3 font-medium">Empresa</th>
                    <th className="px-6 py-3 font-medium">Responsável</th>
                    <th className="px-6 py-3 font-medium">Contato</th>
                    <th className="px-6 py-3 font-medium">Origem</th>
                    <th className="px-6 py-3 font-medium text-right">Valor</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                      Carregando dados...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                data.map((item: any) => {
                  if (activeTab === "contacts") {
                    const contact = item as Contact;
                    return (
                      <tr key={contact.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          {formatDate(contact.created_at)}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {contact.name}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {contact.email}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {contact.last_conversion_date
                            ? formatDate(contact.last_conversion_date)
                            : "-"}
                        </td>
                      </tr>
                    );
                  } else {
                    const deal = item as Deal;
                    return (
                      <tr key={deal.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          {formatDate(
                            activeTab === "won" ? deal.win_at! : deal.created_at
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {deal.organization_name}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {deal.user_name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-gray-900">{deal.email}</span>
                            <span className="text-xs text-gray-400">
                              {deal.phone}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {deal.deal_source_name || "Desconhecido"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(deal.amount_total)}
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && data.length > 0 && renderPagination()}
      </div>
    </div>
  );
};
