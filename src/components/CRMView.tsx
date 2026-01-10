import React, { useMemo, useState, useEffect } from "react";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type TabType = "won" | "opportunity" | "qualified" | "contacts";
type SortDirection = "asc" | "desc";
type PeriodKey = "today" | "month" | "quarter" | "year" | "custom";

const CRM_FILTERS_KEY = "sodeli_crm_filters_v1";

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function startOfMonthISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

function startOfQuarterISO(): string {
  const d = new Date();
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  const mm = String(quarterStartMonth + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

function startOfYearISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function safeReadCRMFilters(): any | null {
  try {
    const raw = localStorage.getItem(CRM_FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeDateValue(date: any): string {
  if (!date) return "";
  if (typeof date === "string") return date;
  if (typeof date === "object" && typeof date.value === "string")
    return date.value;
  return String(date);
}

function normalizeStringValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.value === "string") return v.value;
  return String(v);
}

function parseSortableDate(v: any): number {
  const s = normalizeDateValue(v);
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function compareValues(
  a: any,
  b: any,
  direction: SortDirection,
  type: "text" | "number" | "date"
) {
  let result = 0;

  if (type === "number") {
    const na = Number(a ?? 0);
    const nb = Number(b ?? 0);
    result = na === nb ? 0 : na > nb ? 1 : -1;
  } else if (type === "date") {
    const da = parseSortableDate(a);
    const db = parseSortableDate(b);
    result = da === db ? 0 : da > db ? 1 : -1;
  } else {
    const sa = normalizeStringValue(a).toLowerCase();
    const sb = normalizeStringValue(b).toLowerCase();
    result = sa.localeCompare(sb, "pt-BR");
  }

  return direction === "asc" ? result : -result;
}

function inRange(dateAny: any, startISO: string, endISO: string): boolean {
  const iso = normalizeDateValue(dateAny);
  if (!iso) return false;

  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;

  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();

  return t >= start && t <= end;
}

// ✅ win robusto (boolean, string, number)
function isWonValue(win: any): boolean {
  if (win === true) return true;
  if (win === 1) return true;
  if (typeof win === "string" && win.toLowerCase() === "true") return true;
  return false;
}

export const CRMView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("won");
  const [loading, setLoading] = useState(false);

  const [rawData, setRawData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const colSpan = activeTab === "contacts" ? 4 : 6;

  const savedCRM = safeReadCRMFilters();

  const [period, setPeriod] = useState<PeriodKey>(savedCRM?.period ?? "custom");
  const [dateStart, setDateStart] = useState<string>(
    savedCRM?.dateStart ?? daysAgoISO(30)
  );
  const [dateEnd, setDateEnd] = useState<string>(
    savedCRM?.dateEnd ?? todayISO()
  );

  useEffect(() => {
    localStorage.setItem(
      CRM_FILTERS_KEY,
      JSON.stringify({ period, dateStart, dateEnd })
    );
  }, [period, dateStart, dateEnd]);

  useEffect(() => {
    if (period === "today") {
      const t = todayISO();
      setDateStart(t);
      setDateEnd(t);
      return;
    }
    if (period === "month") {
      setDateStart(startOfMonthISO());
      setDateEnd(todayISO());
      return;
    }
    if (period === "quarter") {
      setDateStart(startOfQuarterISO());
      setDateEnd(todayISO());
      return;
    }
    if (period === "year") {
      setDateStart(startOfYearISO());
      setDateEnd(todayISO());
      return;
    }
  }, [period]);

  const fetchCRMData = async () => {
    setLoading(true);

    try {
      if (activeTab === "contacts") {
        const rows = await api.getContacts({
          dateStart,
          dateEnd,
          limit: 5000, // pode aumentar sem medo agora
        });

        setRawData(rows);
      } else {
        const rows = await api.getDeals({
          dateStart,
          dateEnd,
          limit: 5000,
        });

        // filtro por tipo de aba (client-side)
        const typed = rows.filter((d: any) => {
          const stage = (d.deal_stage_name || "").toLowerCase();
          const won = d.win === true;

          if (activeTab === "won") return won;
          if (activeTab === "qualified") return stage.includes("qualific");
          if (activeTab === "opportunity")
            return !won && !stage.includes("perdid");

          return true;
        });

        setRawData(typed);
      }

      // reset estado visual
      setPage(1);
      setSortKey(null);
      setSortDirection("asc");
    } catch (error) {
      console.error("Error fetching CRM data", error);
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRMData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  function toggleSort(nextKey: string) {
    setSortDirection((prev) =>
      sortKey === nextKey ? (prev === "asc" ? "desc" : "asc") : "asc"
    );
    setSortKey(nextKey);
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k)
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  const filteredAndSorted = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    const filtered = rawData.filter((row: any) => {
      if (!q) return true;

      if (activeTab === "contacts") {
        return (
          (row.name || "").toLowerCase().includes(q) ||
          (row.email || "").toLowerCase().includes(q)
        );
      }

      return (
        (row.organization_name || "").toLowerCase().includes(q) ||
        (row.user_name || "").toLowerCase().includes(q) ||
        ((row.email_negocia_o || row.email || "") as string)
          .toLowerCase()
          .includes(q) ||
        (
          (normalizeStringValue(row.deal_source_name) ||
            row.canal_do_lead ||
            "") as string
        )
          .toLowerCase()
          .includes(q)
      );
    });

    setTotal(filtered.length);

    const sortConfig: Record<
      string,
      { type: "text" | "number" | "date"; get: (r: any) => any }
    > =
      activeTab === "contacts"
        ? {
            created_at: { type: "date", get: (r) => r.created_at },
            name: { type: "text", get: (r) => r.name },
            email: { type: "text", get: (r) => r.email },
            last_conversion_date: {
              type: "date",
              get: (r) => r.last_conversion_date,
            },
          }
        : {
            date: {
              type: "date",
              get: (r) => (activeTab === "won" ? r.win_at : r.created_at),
            },
            organization_name: {
              type: "text",
              get: (r) => r.organization_name,
            },
            user_name: { type: "text", get: (r) => r.user_name },
            contact: {
              type: "text",
              get: (r) => r.email || r.email_negocia_o || r.phone || "",
            },
            deal_source_name: { type: "text", get: (r) => r.deal_source_name },
            amount_total: { type: "number", get: (r) => r.amount_total },
          };

    if (!sortKey || !sortConfig[sortKey]) return filtered;

    const cfg = sortConfig[sortKey];
    return [...filtered].sort((a, b) =>
      compareValues(cfg.get(a), cfg.get(b), sortDirection, cfg.type)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, searchTerm, sortKey, sortDirection, activeTab]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderPagination = () => (
    <div className="flex items-center justify-between px-2 py-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">
        Mostrando {(page - 1) * PAGE_SIZE + 1} a{" "}
        {Math.min(page * PAGE_SIZE, total)} de {total} resultados
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-xs text-gray-500">
          {page} / {totalPages}
        </span>

        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          aria-label="Próxima página"
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

  const ThSort: React.FC<{
    label: string;
    sortId: string;
    className?: string;
    alignRight?: boolean;
  }> = ({ label, sortId, className, alignRight }) => (
    <th
      onClick={() => toggleSort(sortId)}
      className={cn(
        "px-6 py-3 font-medium select-none cursor-pointer hover:bg-gray-100/60 transition-colors",
        alignRight ? "text-right" : "",
        className
      )}
      title="Clique para ordenar"
    >
      <div
        className={cn(
          "flex items-center gap-2",
          alignRight ? "justify-end" : "justify-start"
        )}
      >
        <span>{label}</span>
        <SortIcon k={sortId} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
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

      {/* Filters */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Período</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                className="h-10 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="today">Hoje</option>
                <option value="month">Mês atual</option>
                <option value="quarter">Trimestre atual</option>
                <option value="year">Ano atual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Data inicial</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  setPeriod("custom");
                }}
                className="h-10 px-3 rounded-md border border-gray-200 text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Data final</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                  setPeriod("custom");
                }}
                className="h-10 px-3 rounded-md border border-gray-200 text-sm"
              />
            </div>
          </div>

          <button
            onClick={() => fetchCRMData()}
            className="h-10 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Aplicar filtros
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Intervalo: <span className="font-medium">{dateStart}</span> →{" "}
          <span className="font-medium">{dateEnd}</span>
        </p>
      </section>

      {/* Search */}
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

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                {activeTab === "contacts" ? (
                  <>
                    <ThSort
                      label="Data Criação"
                      sortId="created_at"
                      className="w-[160px]"
                    />
                    <ThSort label="Nome" sortId="name" className="w-[240px]" />
                    <ThSort
                      label="Email"
                      sortId="email"
                      className="w-[260px]"
                    />
                    <ThSort
                      label="Última Conversão"
                      sortId="last_conversion_date"
                      className="w-[180px]"
                    />
                  </>
                ) : (
                  <>
                    <ThSort
                      label={
                        activeTab === "won" ? "Data Venda" : "Data Criação"
                      }
                      sortId="date"
                      className="w-[150px]"
                    />
                    <ThSort
                      label="Empresa"
                      sortId="organization_name"
                      className="w-[280px]"
                    />
                    <ThSort
                      label="Responsável"
                      sortId="user_name"
                      className="w-[220px]"
                    />
                    <ThSort
                      label="Contato"
                      sortId="contact"
                      className="w-[240px]"
                    />
                    <ThSort
                      label="Origem"
                      sortId="deal_source_name"
                      className="w-[220px]"
                    />
                    <ThSort
                      label="Valor"
                      sortId="amount_total"
                      alignRight
                      className="w-[160px]"
                    />
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                      Carregando dados...
                    </div>
                  </td>
                </tr>
              ) : pagedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                pagedData.map((item: any) => {
                  if (activeTab === "contacts") {
                    const contact = item as Contact;
                    return (
                      <tr key={contact.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDate(normalizeDateValue(contact.created_at))}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 truncate">
                          {contact.name}
                        </td>
                        <td className="px-6 py-4 text-gray-500 truncate">
                          {contact.email}
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {contact.last_conversion_date
                            ? formatDate(
                                normalizeDateValue(contact.last_conversion_date)
                              )
                            : "-"}
                        </td>
                      </tr>
                    );
                  }

                  const deal = item as Deal;
                  const contactEmail =
                    (deal as any).email_negocia_o || deal.email || "-";
                  const contactPhone = deal.phone || "-";

                  return (
                    <tr key={deal.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(
                          normalizeDateValue(
                            activeTab === "won" ? deal.win_at : deal.created_at
                          )
                        )}
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900 truncate">
                        {deal.organization_name}
                      </td>

                      <td className="px-6 py-4 text-gray-500 truncate">
                        {deal.user_name}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col leading-tight">
                          <span className="text-gray-900 truncate">
                            {contactEmail}
                          </span>
                          <span className="text-xs text-gray-400 truncate">
                            {contactPhone}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 max-w-full truncate">
                          {normalizeStringValue(deal.deal_source_name) ||
                            "Desconhecido"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(deal.amount_total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && renderPagination()}
      </div>
    </div>
  );
};
