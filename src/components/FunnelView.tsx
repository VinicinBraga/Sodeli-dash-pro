import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { OverviewMetrics, PlatformPerformance } from "../types";
import { MetricCard } from "./MetricCard";
import { formatCurrency, formatNumber, formatPercent } from "../lib/utils";
import {
  Users,
  Filter,
  Target,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type OverviewResponse = {
  total: OverviewMetrics;
  platforms: any[]; // rows agregadas por date+platform (vem do backend)
};

const platformLabel: Record<string, string> = {
  all: "Todas",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  linkedin_ads: "LinkedIn Ads",
};

type PeriodKey = "today" | "month" | "quarter" | "year" | "custom";

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
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3; // 0,3,6,9
  const mm = String(quarterStartMonth + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

function startOfYearISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

// Normaliza o campo date que pode vir como:
// - "2025-12-01"
// - { value: "2025-12-01" }
function normalizeDateValue(date: any): string {
  if (!date) return "";
  if (typeof date === "string") return date;
  if (typeof date === "object" && typeof date.value === "string")
    return date.value;
  return String(date);
}

export const FunnelView: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // ===== Filtros
  const [period, setPeriod] = useState<PeriodKey>("custom");
  const [dateStart, setDateStart] = useState<string>(daysAgoISO(30));
  const [dateEnd, setDateEnd] = useState<string>(todayISO());
  const [platform, setPlatform] = useState<string>("all");

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformPerformance | null>(null);

  // Quando o período muda, ajusta as datas (exceto custom)
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
    // custom -> não mexe nas datas
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await api.getOverview({
        dateStart,
        dateEnd,
        platform,
      });
      setData(result);
    } catch (error) {
      console.error("Failed to fetch overview", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // primeira carga
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monta cards por plataforma + histórico diário pra modal
  const platformsUI: PlatformPerformance[] = useMemo(() => {
    if (!data?.platforms?.length) return [];

    const map = new Map<
      string,
      {
        platform: string;
        leads: number;
        qualified_leads: number;
        opportunities: number;
        sales: number;
        spend: number;
        clicks: number;
        impressions: number;
        dailyHistory: Array<{ date: string; spend: number; leads: number }>;
      }
    >();

    for (const r of data.platforms) {
      const p = r.platform || "unknown";
      const dateStr = normalizeDateValue(r.date);

      const cur = map.get(p) || {
        platform: p,
        leads: 0,
        qualified_leads: 0,
        opportunities: 0,
        sales: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        dailyHistory: [],
      };

      cur.leads += Number(r.leads || 0);
      cur.qualified_leads += Number(r.qualified_leads || 0);
      cur.opportunities += Number(r.opportunities || 0);
      cur.sales += Number(r.sales || 0);
      cur.spend += Number(r.spend || 0);
      cur.clicks += Number(r.clicks || 0);
      cur.impressions += Number(r.impressions || 0);

      if (dateStr) {
        cur.dailyHistory.push({
          date: dateStr,
          spend: Number(r.spend || 0),
          leads: Number(r.leads || 0),
        });
      }

      map.set(p, cur);
    }

    const arr = Array.from(map.values()).map((x) => {
      const cpl = x.leads > 0 ? x.spend / x.leads : null;
      const cpv = x.sales > 0 ? x.spend / x.sales : null;

      x.dailyHistory.sort((a, b) => a.date.localeCompare(b.date));

      return {
        platform: x.platform,
        leads: x.leads,
        qualified_leads: x.qualified_leads,
        opportunities: x.opportunities,
        sales: x.sales,
        spend: x.spend,
        clicks: x.clicks,
        impressions: x.impressions,
        cpl,
        cpv,
        // @ts-ignore - seu type pode não ter dailyHistory
        dailyHistory: x.dailyHistory,
      } as PlatformPerformance;
    });

    const order = ["google_ads", "meta_ads", "linkedin_ads"];
    arr.sort(
      (a: any, b: any) => order.indexOf(a.platform) - order.indexOf(b.platform)
    );

    return arr;
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!data) return <div>Erro ao carregar dados.</div>;

  const total = data.total;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Período */}
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

            {/* Datas */}
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

            {/* Plataforma */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Plataforma</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="all">Todas</option>
                <option value="google_ads">Google Ads</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="linkedin_ads">LinkedIn Ads</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="h-10 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Aplicar filtros
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Intervalo: <span className="font-medium">{dateStart}</span> →{" "}
          <span className="font-medium">{dateEnd}</span> · Plataforma:{" "}
          <span className="font-medium">
            {platformLabel[platform] ?? platform}
          </span>
        </p>
      </section>

      {/* Overview Section */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-600" />
          Visão Geral do Funil
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Leads Totais"
            value={formatNumber(total.leads)}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            title="Leads Qualificados"
            value={formatNumber(total.qualified_leads)}
            subValue={`Taxa: ${formatPercent(total.rate_leads_to_qualified)}`}
            trend="up"
            icon={<Filter className="h-4 w-4" />}
          />
          <MetricCard
            title="Oportunidades"
            value={formatNumber(total.opportunities)}
            subValue={`Taxa: ${formatPercent(
              total.rate_qualified_to_opportunity
            )}`}
            trend="up"
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            title="Vendas"
            value={formatNumber(total.sales)}
            subValue={`Taxa: ${formatPercent(total.rate_opportunity_to_sale)}`}
            trend="up"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            title="Investimento"
            value={formatCurrency(total.spend)}
            icon={<TrendingUp className="h-4 w-4" />}
            className="border-red-100 bg-red-50/50"
          />
        </div>
      </section>

      {/* Platform Performance Section */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-red-600" />
          Desempenho por Plataforma
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {platformsUI.map((p: any) => (
            <Card
              key={p.platform}
              className="bg-white hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="capitalize flex justify-between items-center">
                  {(p.platform || "").replaceAll("_", " ")}
                  <PieChart className="h-4 w-4 text-gray-400" />
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Leads</p>
                    <p className="text-lg font-bold">{formatNumber(p.leads)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="text-lg font-bold">{formatNumber(p.sales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Investimento</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(p.spend)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CPL</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(p.cpl ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>CPV: {formatCurrency(p.cpv ?? 0)}</span>
                    <span>Cliques: {formatNumber(p.clicks)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlatform(p)}
                  className="w-full mt-4 py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-md transition-colors"
                >
                  Mais detalhes
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Detail Modal */}
      {selectedPlatform && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold capitalize">
                {(selectedPlatform.platform || "").replaceAll("_", " ")} -
                Detalhes Diários
              </h3>
              <button
                onClick={() => setSelectedPlatform(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>

            <div className="p-6">
              <div className="h-80 w-full">
                <h4 className="text-sm font-semibold mb-4 text-gray-600">
                  Histórico de Investimento vs Leads
                </h4>

                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={
                      ((selectedPlatform as any).dailyHistory ?? []) as any[]
                    }
                  >
                    <defs>
                      <linearGradient
                        id="colorSpend"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ef4444"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ef4444"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorLeads"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eee"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) =>
                        new Date(val).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      }
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                    />

                    <Tooltip
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("pt-BR")
                      }
                      formatter={(value: number, name: string) => [
                        name === "spend" ? formatCurrency(value) : value,
                        name === "spend" ? "Investimento" : "Leads",
                      ]}
                    />

                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="spend"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorSpend)"
                      name="spend"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="leads"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                      name="leads"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunnelView;
