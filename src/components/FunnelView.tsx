import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { OverviewMetrics } from "../types";
import { MetricCard } from "./MetricCard";
import { formatCurrency, formatNumber, formatPercent } from "../lib/utils";
import {
  MousePointerClick,
  Filter,
  ShoppingCart,
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
  LineChart,
  Line,
  Legend,
} from "recharts";

import ga4Logo from "../assets/ga4Logo.png";
import googleLogo from "../assets/googleAdsLogo.png";
import metaLogo from "../assets/metaAdsLogo.png";
import linkedinLogo from "../assets/linkedinLogo.png";
import rdLogo from "../assets/rdStationLogo.png";

const PAID_MEDIA_LOGOS = [
  { src: googleLogo, alt: "Google Ads" },
  { src: metaLogo, alt: "Meta Ads" },
  { src: linkedinLogo, alt: "LinkedIn Ads" },
];

const GA4_LOGOS = [{ src: ga4Logo, alt: "GA4" }];
const RD_LOGOS = [{ src: rdLogo, alt: "RD Station" }];

function getPaidLogoByPlatform(plat: string) {
  if (plat === "google_ads") return [{ src: googleLogo, alt: "Google Ads" }];
  if (plat === "meta_ads") return [{ src: metaLogo, alt: "Meta Ads" }];
  if (plat === "linkedin_ads")
    return [{ src: linkedinLogo, alt: "LinkedIn Ads" }];
  // all/other => mostra as 3
  return PAID_MEDIA_LOGOS;
}

type OverviewResponse = {
  total: OverviewMetrics;
  platforms: any[];
  crm_by_platform?: Record<string, { sales_crm: number; revenue_crm: number }>;
};

type PeriodKey = "today" | "month" | "quarter" | "year" | "custom";

type DailyData = { date: string; spend: number; leads: number };

type PlatformCard = {
  platform: string;
  leads: number;
  qualified_leads: number;
  opportunities: number;

  spend: number;
  clicks: number;
  impressions: number;

  // CRM por plataforma
  sales_crm: number;
  revenue_crm: number;

  // métricas derivadas
  cpl: number | null; // spend/leads
  cpv: number | null; // spend/sales_crm
  roas: number | null; // revenue_crm/spend
  ticket: number | null; // revenue_crm/sales_crm

  dailyHistory: DailyData[];
};

type RevenuePoint = {
  date: string; // ISO esperado: YYYY-MM-DD
  revenue_actual: number;
  expected: number;
  pessimistic: number;
  optimistic: number;
  is_history: boolean;
};

type RevenueForecastResponse = {
  accuracy_rate: number; // 0..1
  series: RevenuePoint[];
  start: string;
  end: string;
  horizon: number;
  maWindow: number;
  band: number;
};

const platformLabel: Record<string, string> = {
  all: "Todas",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  linkedin_ads: "LinkedIn Ads",
  other: "Outros",
};

const FILTERS_KEY = "sodeli_funnel_filters_v1";

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

// Normaliza campo date (BQ pode vir como string ou { value: string })
function normalizeDateValue(date: any): string {
  if (!date) return "";
  if (typeof date === "string") return date;
  if (typeof date === "object" && typeof date.value === "string")
    return date.value;
  return String(date);
}

function normalizeBQDate(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d === "object" && typeof d.value === "string") return d.value;
  return String(d);
}

/**
 * Converte QUALQUER formato comum para ISO "YYYY-MM-DD"
 * - "YYYY-MM-DD" => ok
 * - "YYYY/MM/DD" => troca "/" por "-"
 * - "DD/MM/YYYY" => vira "YYYY-MM-DD"
 * - "{ value: ... }" => resolve antes
 */
function toISODate(d: any): string {
  const raw = normalizeBQDate(d);
  if (!raw) return "";

  const s = String(raw).slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replaceAll("/", "-");

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  return s;
}

function formatDM(iso: string): string {
  const s = String(iso).slice(0, 10);
  const dt = new Date(`${s}T00:00:00`);
  return isNaN(dt.getTime())
    ? s
    : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function safeReadFilters(): any | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isValidISODate(s: any): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function SourceBadge({
  logos,
  alt,
}: {
  logos: { src: string; alt: string }[];
  alt?: string;
}) {
  return (
    <div
      className="
        absolute bottom-6 right-5 
        flex items-center gap-1
        translate-y-[-3px]
      "
      title={alt}
    >
      {logos.map((l) => (
        <img
          key={l.alt}
          src={l.src}
          alt={l.alt}
          className="
            h-4 w-4
            object-contain
            border-none
            outline-none
            shadow-none
          "
        />
      ))}
    </div>
  );
}

export const FunnelView: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const saved = safeReadFilters();

  // ===== Filtros (draft vs applied)
  const [period, setPeriod] = useState<PeriodKey>(
    (saved?.period as PeriodKey) ?? "custom"
  );

  const [dateStart, setDateStart] = useState<string>(
    isValidISODate(saved?.dateStart) ? saved.dateStart : daysAgoISO(30)
  );

  const [dateEnd, setDateEnd] = useState<string>(
    isValidISODate(saved?.dateEnd) ? saved.dateEnd : todayISO()
  );

  // Draft (muda no select)
  const [platformDraft, setPlatformDraft] = useState<string>(
    saved?.platform ?? "all"
  );
  // Applied (só muda ao clicar em "Aplicar filtros")
  const [platformApplied, setPlatformApplied] = useState<string>(
    saved?.platform ?? "all"
  );

  const [data, setData] = useState<OverviewResponse | null>(null);

  // modal
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformCard | null>(
    null
  );

  const [revLoading, setRevLoading] = useState(false);
  const [revData, setRevData] = useState<RevenueForecastResponse | null>(null);

  // salva filtros no localStorage (o que vale para os dados)
  useEffect(() => {
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        period,
        dateStart,
        dateEnd,
        platform: platformApplied,
      })
    );
  }, [period, dateStart, dateEnd, platformApplied]);

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
    // custom -> não mexe
  }, [period]);

  // ===== Fetches aceitam plat como parâmetro (aplicado)
  const fetchData = async (plat: string) => {
    setLoading(true);
    try {
      const result = await api.getOverview({
        dateStart,
        dateEnd,
        platform: plat,
      });
      setData(result);
    } catch (error) {
      console.error("Failed to fetch overview", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueForecast = async (plat: string) => {
    setRevLoading(true);
    try {
      const API_BASE = (
        (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080"
      ).replace(/\/$/, "");

      const url = `${API_BASE}/api/revenue-forecast?dateStart=${dateStart}&dateEnd=${dateEnd}&platform=${plat}`;

      const token = localStorage.getItem("auth_token");

      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed revenue forecast");

      setRevData(json);
    } catch (e) {
      console.error("Failed to fetch revenue forecast", e);
      setRevData(null);
    } finally {
      setRevLoading(false);
    }
  };

  // load inicial: usa o applied
  useEffect(() => {
    fetchData(platformApplied);
    fetchRevenueForecast(platformApplied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platformsUI: PlatformCard[] = useMemo(() => {
    const crmPlat = data?.crm_by_platform || {};

    const basePlatforms = ["google_ads", "meta_ads", "linkedin_ads", "other"];

    // Em "all" mostramos sempre as 4.
    // Em filtro específico, mostramos só a selecionada.
    const seedList =
      platformApplied === "all" ? basePlatforms : [platformApplied];

    // Se não vier marketing, ainda assim monta cards com CRM (ex: other/linkedin)
    if (!data?.platforms?.length) {
      return seedList.map((plat) => {
        const crm = crmPlat[plat] || { sales_crm: 0, revenue_crm: 0 };

        const sales_crm = Number(crm.sales_crm || 0);
        const revenue_crm = Number(crm.revenue_crm || 0);

        return {
          platform: plat,

          // Quando não tem marketing por plataforma, não temos leads/oportunidades por plataforma.
          // Se estiver filtrado em uma plataforma específica, usamos o total como referência.
          leads:
            platformApplied !== "all" ? Number(data?.total?.leads ?? 0) : 0,
          qualified_leads: 0,
          opportunities:
            platformApplied !== "all"
              ? Number(data?.total?.opportunities ?? 0)
              : 0,

          spend: 0,
          clicks: 0,
          impressions: 0,

          sales_crm,
          revenue_crm,

          cpl: null,
          cpv: null,
          roas: null,
          ticket: sales_crm > 0 ? revenue_crm / sales_crm : null,

          dailyHistory: [],
        };
      });
    }

    const map = new Map<
      string,
      {
        platform: string;
        leads: number;
        qualified_leads: number;
        opportunities: number;
        spend: number;
        clicks: number;
        impressions: number;
        dailyHistory: DailyData[];
      }
    >();

    // ✅ SEED: garante que as plataformas existam no grid mesmo sem linha de marketing
    for (const p of seedList) {
      map.set(p, {
        platform: p,
        leads: 0,
        qualified_leads: 0,
        opportunities: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        dailyHistory: [],
      });
    }

    // Preenche com o que vier do marketing
    for (const r of data.platforms) {
      const rawPlatform = r.platform;

      // não entra agregado "all" no grid
      if (rawPlatform === "all") continue;

      const p = rawPlatform ? rawPlatform : "other";

      // Se estamos filtrando uma plataforma específica, ignora as outras
      if (platformApplied !== "all" && p !== platformApplied) continue;

      const dateStr = normalizeDateValue(r.date);

      const cur = map.get(p) || {
        platform: p,
        leads: 0,
        qualified_leads: 0,
        opportunities: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        dailyHistory: [],
      };

      cur.leads += Number(r.leads || 0);
      cur.qualified_leads += Number(r.qualified_leads || 0);
      cur.opportunities += Number(r.opportunities || 0);

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

    let arr: PlatformCard[] = Array.from(map.values()).map((x) => {
      x.dailyHistory.sort((a, b) => a.date.localeCompare(b.date));

      const crmForThis = crmPlat[x.platform] || {
        sales_crm: 0,
        revenue_crm: 0,
      };
      const sales_crm = Number(crmForThis.sales_crm || 0);
      const revenue_crm = Number(crmForThis.revenue_crm || 0);

      const cpl = x.leads > 0 ? x.spend / x.leads : null;
      const cpv = sales_crm > 0 ? x.spend / sales_crm : null;
      const roas = x.spend > 0 ? revenue_crm / x.spend : null;
      const ticket = sales_crm > 0 ? revenue_crm / sales_crm : null;

      return {
        platform: x.platform,
        leads: x.leads,
        qualified_leads: x.qualified_leads,
        opportunities: x.opportunities,

        spend: x.spend,
        clicks: x.clicks,
        impressions: x.impressions,

        sales_crm,
        revenue_crm,

        cpl,
        cpv,
        roas,
        ticket,

        dailyHistory: x.dailyHistory,
      };
    });

    const order = ["google_ads", "meta_ads", "linkedin_ads", "other"];
    arr.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));

    return arr;
  }, [data, platformApplied]);

  const platformGridClass =
    platformsUI.length === 4
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-3";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!data) return <div>Erro ao carregar dados.</div>;

  const total = data.total;

  const leads = total.leads ?? 0;
  const visits = total.visits ?? 0;
  const opps = total.opportunities ?? 0;
  const sales = total.sales_crm ?? total.sales ?? 0;

  const rateLeadsVisits = visits > 0 ? leads / visits : 0;
  const rateOppsLeads = leads > 0 ? opps / leads : 0;
  const rateSalesOpps = opps > 0 ? sales / opps : 0;

  // ===== Série ÚNICA pro gráfico
  const seriesChart = (revData?.series || [])
    .map((p: any) => {
      const date = toISODate(p.date);

      return {
        date,
        revenue_actual: Number(p.revenue_actual ?? 0),
        expected: Number(p.expected ?? 0),
        optimistic: Number(p.optimistic ?? 0),
        pessimistic: Number(p.pessimistic ?? 0),
      };
    })
    .filter((p: any) => !!p.date)
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // ===== Card Visitas/Cliques deve respeitar APENAS o filtro aplicado
  const isFiltered = platformApplied !== "all";
  const topLabel = isFiltered ? "Cliques" : "Visitas";
  const topValue = isFiltered ? total.clicks ?? 0 : total.visits ?? 0;
  const topSubLabel = isFiltered ? "CPC" : "Custo por Sessão";
  const topSubValue = isFiltered
    ? formatCurrency(total.clicks ? total.spend / total.clicks : 0)
    : formatCurrency(total.visits ? total.spend / total.visits : 0);

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

            {/* Plataforma (DRAFT) */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Plataforma</label>
              <select
                value={platformDraft}
                onChange={(e) => setPlatformDraft(e.target.value)}
                className="h-10 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="all">Todas</option>
                <option value="google_ads">Google Ads</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="linkedin_ads">LinkedIn Ads</option>
                <option value="other">Outros</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              // ✅ aplica a plataforma (somente aqui)
              setPlatformApplied(platformDraft);

              // ✅ busca usando a plataforma do draft (pra não depender do setState assíncrono)
              fetchData(platformDraft);
              fetchRevenueForecast(platformDraft);
            }}
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

      {/* Overview Section */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-600" />
          Visão Geral do Funil
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 mb-3">
          <div>
            Eficiência{" "}
            <span className="font-medium text-gray-700">
              Leads / Sessões (GA4)
            </span>{" "}
            <span className="font-semibold text-gray-900">
              {formatPercent(rateLeadsVisits)}
            </span>
          </div>

          <div>
            Tx Conv.{" "}
            <span className="font-medium text-gray-700">Oport. / Leads</span>{" "}
            <span className="font-semibold text-gray-900">
              {formatPercent(rateOppsLeads)}
            </span>
          </div>

          <div>
            Tx Conv.{" "}
            <span className="font-medium text-gray-700">Vendas / Oport.</span>{" "}
            <span className="font-semibold text-gray-900">
              {formatPercent(rateSalesOpps)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ESQUERDA: Big Numbers */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <MetricCard
                title="Investimentos"
                value={formatCurrency(total.spend)}
                subValue={`ROAS: ${formatNumber(
                  total.spend
                    ? (total.revenue_crm ?? total.revenue ?? 0) / total.spend
                    : 0
                )}`}
                icon={<BarChart3 className="h-4 w-4" />}
              />

              <SourceBadge
                logos={getPaidLogoByPlatform(platformApplied)}
                alt="Mídia paga"
              />
            </div>

            <div className="relative">
              <MetricCard
                title={topLabel}
                value={formatNumber(topValue)}
                subValue={`${topSubLabel}: ${topSubValue}`}
                icon={<MousePointerClick className="h-4 w-4" />}
              />

              <SourceBadge
                logos={
                  isFiltered
                    ? getPaidLogoByPlatform(platformApplied)
                    : GA4_LOGOS
                }
                alt={isFiltered ? "Mídia paga" : "GA4"}
              />
            </div>

            <div className="relative">
              <MetricCard
                title="Leads"
                value={formatNumber(total.leads ?? 0)}
                subValue={`CPL: ${formatCurrency(
                  total.leads ? total.spend / total.leads : 0
                )}`}
                icon={<Filter className="h-4 w-4" />}
              />

              <SourceBadge
                logos={
                  platformApplied === "other"
                    ? RD_LOGOS
                    : getPaidLogoByPlatform(platformApplied)
                }
                alt={platformApplied === "other" ? "RD Station" : "Mídia paga"}
              />
            </div>

            <div className="relative">
              <MetricCard
                title="Oportunidades"
                value={formatNumber(total.opportunities ?? 0)}
                subValue={`CPO: ${formatCurrency(
                  total.opportunities ? total.spend / total.opportunities : 0
                )}`}
                icon={<TrendingUp className="h-4 w-4" />}
              />

              <SourceBadge
                logos={
                  platformApplied === "other"
                    ? RD_LOGOS
                    : getPaidLogoByPlatform(platformApplied)
                }
                alt={platformApplied === "other" ? "RD Station" : "Mídia paga"}
              />
            </div>

            <div className="relative">
              <MetricCard
                title="Vendas"
                value={formatNumber(total.sales_crm ?? total.sales ?? 0)}
                subValue={`CPA: ${formatCurrency(
                  total.sales_crm ?? total.sales
                    ? total.spend / (total.sales_crm ?? total.sales)
                    : 0
                )}`}
                icon={<ShoppingCart className="h-4 w-4" />}
              />

              <SourceBadge logos={RD_LOGOS} alt="RD Station" />
            </div>

            <div className="relative">
              <MetricCard
                title="Receita"
                value={formatCurrency(total.revenue_crm ?? total.revenue ?? 0)}
                subValue={`Ticket Médio: ${formatCurrency(
                  total.sales_crm ?? total.sales
                    ? (total.revenue_crm ?? total.revenue ?? 0) /
                        (total.sales_crm ?? total.sales)
                    : 0
                )}`}
                icon={<DollarSign className="h-4 w-4" />}
              />

              <SourceBadge logos={RD_LOGOS} alt="RD Station" />
            </div>
          </div>

          {/* DIREITA: Funil */}
          <Card className="bg-white lg:col-span-1">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Funil de Conversão
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              {(() => {
                const steps = [
                  {
                    key: "top",
                    label: isFiltered ? "Cliques" : "Visitas",
                    value: isFiltered ? total.clicks ?? 0 : total.visits ?? 0,
                  },
                  { key: "leads", label: "Leads", value: total.leads ?? 0 },
                  {
                    key: "opps",
                    label: "Oportunidades",
                    value: total.opportunities ?? 0,
                  },
                  {
                    key: "sales",
                    label: "Vendas",
                    value: total.sales_crm ?? total.sales ?? 0,
                  },
                ];

                const max = Math.max(...steps.map((s) => s.value), 1);
                const pct = (a: number, b: number) => (b > 0 ? a / b : 0);

                return (
                  <div className="space-y-4">
                    {steps.map((s, idx) => {
                      const prev = idx === 0 ? null : steps[idx - 1];
                      const conv = prev ? pct(s.value, prev.value) : null;
                      const widthPct = Math.max(
                        8,
                        Math.round((s.value / max) * 100)
                      );

                      return (
                        <div key={s.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <div className="font-semibold text-gray-700">
                              {s.label}{" "}
                              <span className="font-normal text-gray-500">
                                ({formatNumber(s.value)})
                              </span>
                            </div>
                            {conv !== null && (
                              <div className="text-gray-500">
                                Conv.:{" "}
                                <span className="font-semibold text-gray-700">
                                  {formatPercent(conv)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="w-full bg-gray-100 rounded-md h-6 overflow-hidden">
                            <div
                              className="h-6 rounded-md"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: "#ef002c",
                                opacity: 0.25 + idx * 0.18,
                              }}
                              title={`${s.label}: ${formatNumber(s.value)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platform Performance Section */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-red-600" />
          Desempenho por Plataforma
        </h2>

        <div className={`grid ${platformGridClass} gap-6`}>
          {platformsUI.map((p) => (
            <Card
              key={p.platform}
              className="bg-white hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="capitalize flex justify-between items-center">
                  {platformLabel[p.platform] ?? p.platform}
                  <PieChart className="h-4 w-4 text-gray-400" />
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Investimento</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(p.spend)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ROAS: {formatNumber(p.roas ?? 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Cliques</p>
                    <p className="text-lg font-bold">
                      {formatNumber(p.clicks)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      CPC: {formatCurrency(p.clicks ? p.spend / p.clicks : 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Leads</p>
                    <p className="text-lg font-bold">{formatNumber(p.leads)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      CPL: {formatCurrency(p.cpl ?? 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Oportunidades</p>
                    <p className="text-lg font-bold">
                      {formatNumber(p.opportunities)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      CPO:{" "}
                      {formatCurrency(
                        p.opportunities ? p.spend / p.opportunities : 0
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="text-lg font-bold">
                      {formatNumber(p.sales_crm)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      CPA:{" "}
                      {formatCurrency(p.sales_crm ? p.spend / p.sales_crm : 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Receita</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(p.revenue_crm)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ticket: {formatCurrency(p.ticket ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Impressões: {formatNumber(p.impressions)}</span>
                    <span>
                      Plataforma: {platformLabel[p.platform] ?? p.platform}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlatform(p)}
                  className="
    w-full mt-2 py-2 px-4
    rounded-md
    text-sm font-medium
    transition-colors

    bg-gray-100 text-gray-700 hover:bg-gray-200
    dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800
  "
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
                {platformLabel[selectedPlatform.platform] ??
                  selectedPlatform.platform}{" "}
                - Detalhes Diários
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
                  <AreaChart data={selectedPlatform.dailyHistory ?? []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eee"
                    />

                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => {
                        const iso = toISODate(val);
                        return formatDM(iso);
                      }}
                    />

                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                    />

                    <Tooltip
                      labelFormatter={(label) => {
                        const iso = toISODate(label);
                        const dt = new Date(`${iso}T00:00:00`);
                        return isNaN(dt.getTime())
                          ? iso
                          : dt.toLocaleDateString("pt-BR");
                      }}
                      formatter={(value: number, name: string) => [
                        name === "spend" ? formatCurrency(value) : value,
                        name === "spend" ? "Investimento" : "Leads",
                      ]}
                    />

                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="spend"
                      stroke="#ef002c"
                      fillOpacity={0.15}
                      fill="#ef002c"
                      name="spend"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="leads"
                      stroke="#ef002c"
                      fillOpacity={0.08}
                      fill="#ef002c"
                      name="leads"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receita Histórica & Projeção */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-600" />
          Receita Histórica & Projeção
        </h2>

        <Card className="bg-white">
          <CardHeader className="border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Receita (Real x Cenários)
            </CardTitle>

            <div className="text-xs px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
              Acurácia:{" "}
              <span className="font-semibold">
                {formatPercent(revData?.accuracy_rate ?? 0)}
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {revLoading && (
              <div className="flex h-56 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
              </div>
            )}

            {!revLoading && !revData && (
              <div className="text-sm text-gray-500">
                Não foi possível carregar o gráfico de receita.
              </div>
            )}

            {!revLoading && revData && (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seriesChart}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eee"
                    />

                    <XAxis
                      dataKey="date"
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => formatDM(String(val))}
                    />

                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        typeof v === "number"
                          ? v.toLocaleString("pt-BR", {
                              notation: "compact",
                              compactDisplay: "short",
                            })
                          : String(v)
                      }
                    />

                    <Tooltip
                      labelFormatter={(label) => {
                        const iso = toISODate(label);
                        const dt = new Date(`${iso}T00:00:00`);
                        return isNaN(dt.getTime())
                          ? iso
                          : dt.toLocaleDateString("pt-BR");
                      }}
                      formatter={(value: any, name: string) => {
                        const labelMap: Record<string, string> = {
                          revenue_actual: "Real",
                          expected: "Esperado",
                          optimistic: "Otimista",
                          pessimistic: "Pessimista",
                        };
                        return [
                          formatCurrency(Number(value || 0)),
                          labelMap[name] ?? name,
                        ];
                      }}
                    />

                    <Legend />

                    <Line
                      type="monotone"
                      dataKey="revenue_actual"
                      stroke="var(--chart-real)"
                      strokeWidth={3}
                      dot={false}
                      name="Real"
                    />

                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke="#ef002c"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="6 4"
                      name="Esperado"
                    />

                    <Line
                      type="monotone"
                      dataKey="pessimistic"
                      stroke="#b0001f"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="2 6"
                      name="Pessimista"
                    />

                    <Line
                      type="monotone"
                      dataKey="optimistic"
                      stroke="#ef002c"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 4"
                      name="Otimista"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default FunnelView;
