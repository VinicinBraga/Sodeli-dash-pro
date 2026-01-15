const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { BigQuery } = require("@google-cloud/bigquery");

const app = express();
const PORT = process.env.PORT || 8080;

// ===== CORS
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "https://sodeli-dash-pro.vercel.app",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman
      return allowedOrigins.has(origin) ? cb(null, true) : cb(null, false); // bloqueia silencioso
    },
    methods: ["GET", "OPTIONS"],
  })
);

app.use(express.json());

// ===== Resolve credenciais (transforma em caminho absoluto)
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : undefined;

// ===== BigQuery Client
const bigquery = new BigQuery({
  projectId: process.env.BQ_PROJECT_ID,
  ...(credPath ? { keyFilename: credPath } : {}),
});

const DATASET = process.env.BQ_DATASET;

// ===== Utils
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ===== Healthcheck
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// ============================
// OVERVIEW (Dashboard principal)
// ============================
app.get("/api/overview", async (req, res) => {
  try {
    const { dateStart, dateEnd, platform } = req.query;

    // defaults (se não vier, pega últimos 30 dias)
    const start = dateStart || daysAgoISO(30);
    const end = dateEnd || todayISO();
    const plat = platform || "all";

    // ===== 1) Série diária (dashboard_overview_daily)
    const where = [];
    where.push(`date >= DATE(@start)`);
    where.push(`date <= DATE(@end)`);
    if (plat !== "all") where.push(`platform = @platform`);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        date,
        platform,
        SUM(leads) AS leads,
        SUM(qualified_leads) AS qualified_leads,
        SUM(opportunities) AS opportunities,
        SUM(sales) AS sales,
        SUM(spend) AS spend,
        SUM(clicks) AS clicks,
        SUM(impressions) AS impressions,
        SAFE_DIVIDE(SUM(spend), SUM(leads)) AS cpl,
        SAFE_DIVIDE(SUM(spend), SUM(qualified_leads)) AS cpq,
        SAFE_DIVIDE(SUM(spend), SUM(opportunities)) AS cpo,
        SAFE_DIVIDE(SUM(spend), SUM(sales)) AS cpv,
        SAFE_DIVIDE(SUM(qualified_leads), SUM(leads)) AS rate_leads_to_qualified,
        SAFE_DIVIDE(SUM(opportunities), SUM(qualified_leads)) AS rate_qualified_to_opportunity,
        SAFE_DIVIDE(SUM(sales), SUM(opportunities)) AS rate_opportunity_to_sale
      FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.dashboard_overview_daily\`
      ${whereClause}
      GROUP BY date, platform
      ORDER BY date ASC
    `;

    const params = { start, end };
    if (plat !== "all") params.platform = plat;

    const [rows] = await bigquery.query({ query, params });

    const FUNNEL_PLATFORMS = new Set([
      "google_ads",
      "meta_ads",
      "linkedin_ads",
    ]);

    const total = rows.reduce(
      (acc, r) => {
        const p = String(r.platform || "");

        // ✅ Funil: só plataformas digitais
        if (FUNNEL_PLATFORMS.has(p)) {
          acc.leads += Number(r.leads || 0);
          acc.qualified_leads += Number(r.qualified_leads || 0);
          acc.opportunities = Math.max(
            acc.opportunities,
            Number(r.opportunities || 0)
          );
        }

        // ✅ Marketing (investimento/cliques/impressões) continua somando só do que existir na visão
        acc.spend += Number(r.spend || 0);
        acc.clicks += Number(r.clicks || 0);
        acc.impressions += Number(r.impressions || 0);

        return acc;
      },
      {
        leads: 0,
        qualified_leads: 0,
        opportunities: 0,
        sales: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
      }
    );

    // ===== 2) Receita real do CRM (deals ganhos) no período
    const crmQuery = `
      SELECT
        COUNT(1) AS sales_crm,
        SUM(COALESCE(amount_total, 0)) AS revenue_crm
      FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__deals\`
      WHERE
        (win IS TRUE OR LOWER(CAST(win AS STRING)) = 'true')
        AND win_at IS NOT NULL
        AND DATE(win_at) BETWEEN DATE(@start) AND DATE(@end)
    `;

    const [crmRows] = await bigquery.query({
      query: crmQuery,
      params: { start, end },
    });

    const crm = crmRows?.[0] || { sales_crm: 0, revenue_crm: 0 };

    // ===== 3) Visitas (GA4) no período (com clamp no range disponível)
    const ga4RangeQuery = `
      SELECT
        MIN(date) AS min_date,
        MAX(date) AS max_date
      FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.fact_ga4_daily\`
    `;
    const [ga4RangeRows] = await bigquery.query({ query: ga4RangeQuery });
    const ga4Range = ga4RangeRows?.[0] || { min_date: null, max_date: null };

    let visits = 0;

    if (ga4Range.min_date && ga4Range.max_date) {
      const requestedStart = new Date(start);
      const requestedEnd = new Date(end);

      const minDate = new Date(ga4Range.min_date.value || ga4Range.min_date);
      const maxDate = new Date(ga4Range.max_date.value || ga4Range.max_date);

      const clampedStart = requestedStart < minDate ? minDate : requestedStart;
      const clampedEnd = requestedEnd > maxDate ? maxDate : requestedEnd;

      if (clampedStart <= clampedEnd) {
        const ga4Query = `
          SELECT
            SUM(COALESCE(sessions, 0)) AS visits
          FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.fact_ga4_daily\`
          WHERE date BETWEEN DATE(@start) AND DATE(@end)
        `;

        const [ga4Rows] = await bigquery.query({
          query: ga4Query,
          params: {
            start: clampedStart.toISOString().slice(0, 10),
            end: clampedEnd.toISOString().slice(0, 10),
          },
        });

        visits = Number(ga4Rows?.[0]?.visits || 0);
      }
    }

    // ===== 2.1) Vendas/Receita do CRM por plataforma (mapeando origem)
    const crmByPlatformQuery = `
SELECT
  CASE
    WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%google%' THEN 'google_ads'
    WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%meta%' OR LOWER(COALESCE(deal_source_name, '')) LIKE '%facebook%' OR LOWER(COALESCE(deal_source_name, '')) LIKE '%instagram%' THEN 'meta_ads'
    WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%linkedin%' THEN 'linkedin_ads'
    ELSE 'other'
  END AS platform,
  COUNT(1) AS sales_crm,
  SUM(COALESCE(amount_total, 0)) AS revenue_crm
FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__deals\`
WHERE
  (win IS TRUE OR LOWER(CAST(win AS STRING)) = 'true')
  AND win_at IS NOT NULL
  AND DATE(win_at) BETWEEN DATE(@start) AND DATE(@end)
GROUP BY 1
`;

    const [crmPlatRows] = await bigquery.query({
      query: crmByPlatformQuery,
      params: { start, end },
    });

    // vira um objeto { google_ads: {...}, meta_ads: {...}, ... }
    const crm_by_platform = (crmPlatRows || []).reduce((acc, r) => {
      acc[r.platform] = {
        sales_crm: Number(r.sales_crm || 0),
        revenue_crm: Number(r.revenue_crm || 0),
      };
      return acc;
    }, {});

    let sales_crm_total = Number(crm.sales_crm || 0);
    let revenue_crm_total = Number(crm.revenue_crm || 0);

    if (plat !== "all") {
      const crmPlat = crm_by_platform?.[plat];
      if (crmPlat) {
        sales_crm_total = Number(crmPlat.sales_crm || 0);
        revenue_crm_total = Number(crmPlat.revenue_crm || 0);
      } else {
        sales_crm_total = 0;
        revenue_crm_total = 0;
      }
    }
    // ✅ Se filtro for "other", preencher LEADS e OPORTUNIDADES via CRM
    if (plat === "other") {
      const crmOtherQuery = `
    SELECT
      COUNT(1) AS leads_other,
      COUNTIF(
        NOT (win IS TRUE OR LOWER(CAST(win AS STRING)) = 'true')
        AND NOT LOWER(COALESCE(deal_stage_name, '')) LIKE '%perdid%'
      ) AS opportunities_other
    FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__deals\`
    WHERE
      created_at IS NOT NULL
      AND DATE(created_at) BETWEEN DATE(@start) AND DATE(@end)
      AND (
        CASE
          WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%google%' THEN 'google_ads'
          WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%meta%'
            OR LOWER(COALESCE(deal_source_name, '')) LIKE '%facebook%'
            OR LOWER(COALESCE(deal_source_name, '')) LIKE '%instagram%' THEN 'meta_ads'
          WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%linkedin%' THEN 'linkedin_ads'
          ELSE 'other'
        END
      ) = 'other'
  `;

      const [crmOtherRows] = await bigquery.query({
        query: crmOtherQuery,
        params: { start, end },
      });

      const crmOther = crmOtherRows?.[0] || {
        leads_other: 0,
        opportunities_other: 0,
      };

      // sobrescreve os números do funil para "Outros"
      total.leads = Number(crmOther.leads_other || 0);
      total.opportunities = Number(crmOther.opportunities_other || 0);
    }

    // ===== resposta única
    return res.json({
      total: {
        ...total,
        visits,
        sales_crm: sales_crm_total,
        revenue_crm: revenue_crm_total,
      },
      platforms: rows,
      crm_by_platform,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// ============================
// REVENUE FORECAST (Histórico + Cenários por DIA, dentro do período)
// ============================
app.get("/api/revenue-forecast", async (req, res) => {
  try {
    const { dateStart, dateEnd, platform } = req.query;
    const plat = platform || "all";

    const start = dateStart || daysAgoISO(90);
    const end = dateEnd || todayISO();

    // parâmetros do modelo (simples, explicável)
    const maWindow = 14; // média móvel (N dias)
    const band = 0.2; // +/-20% (otimista/pessimista)
    const maWindowMinus1 = maWindow - 1;

    const query = `
      -- 1) Receita diária real no período
      WITH revenue_daily AS (
        SELECT
          DATE(win_at) AS date,
          SUM(COALESCE(amount_total, 0)) AS revenue_actual
        FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__deals\`
        WHERE
          (win IS TRUE OR LOWER(CAST(win AS STRING)) = 'true')
          AND win_at IS NOT NULL
          AND DATE(win_at) BETWEEN DATE(@start) AND DATE(@end)
          AND (
            @platform = 'all'
            OR CASE
              WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%google%' THEN 'google_ads'
              WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%meta%'
                OR LOWER(COALESCE(deal_source_name, '')) LIKE '%facebook%'
                OR LOWER(COALESCE(deal_source_name, '')) LIKE '%instagram%' THEN 'meta_ads'
              WHEN LOWER(COALESCE(deal_source_name, '')) LIKE '%linkedin%' THEN 'linkedin_ads'
              ELSE 'other'
            END = @platform
          )
        GROUP BY 1
      ),

      -- 2) Datas do período: mantém duas colunas
      --    - revenue_actual_filled: 0 quando não há venda (pra plotar o "Real")
      --    - revenue_actual_raw: NULL quando não há venda (pra média móvel ignorar)
      filled AS (
        SELECT
          d AS date,
          COALESCE(r.revenue_actual, 0) AS revenue_actual_filled,
          r.revenue_actual AS revenue_actual_raw
        FROM UNNEST(GENERATE_DATE_ARRAY(DATE(@start), DATE(@end))) AS d
        LEFT JOIN revenue_daily r
          ON r.date = d
      ),
      
      -- 3) Expected por dia (média móvel IGNORANDO dias sem venda)
      calc AS (
        SELECT
          date,
          revenue_actual_filled AS revenue_actual,
          COALESCE(
            AVG(revenue_actual_raw) OVER (
              ORDER BY date
              ROWS BETWEEN ${maWindowMinus1} PRECEDING AND CURRENT ROW
            ),
            0
          ) AS expected
        FROM filled
      ),

      -- 4) Série final com bandas
      final_series AS (
        SELECT
          date,
          revenue_actual,
          expected,
          expected * (1 - @band) AS pessimistic,
          expected * (1 + @band) AS optimistic,
          TRUE AS is_history
        FROM calc
      ),

      -- 5) Acurácia: últimos N dias do período (MAPE simples -> 0..1)
      accuracy AS (
        SELECT
          GREATEST(
            0,
            LEAST(
              1,
              1 - AVG(
                SAFE_DIVIDE(ABS(revenue_actual - expected), NULLIF(expected, 0))
              )
            )
          ) AS accuracy_rate
        FROM final_series
        WHERE date BETWEEN DATE_SUB(DATE(@end), INTERVAL ${maWindowMinus1} DAY) AND DATE(@end)
      )

      SELECT
        (SELECT accuracy_rate FROM accuracy) AS accuracy_rate,
        ARRAY_AGG(STRUCT(
          date,
          revenue_actual,
          expected,
          pessimistic,
          optimistic,
          is_history
        ) ORDER BY date) AS series
      FROM final_series
    `;

    const [rows] = await bigquery.query({
      query,
      params: { start, end, maWindow, maWindowMinus1, band, platform: plat },
    });

    const out = rows?.[0] || { accuracy_rate: 0, series: [] };

    return res.json({
      start,
      end,
      horizon: 0, // agora não projetamos "pra frente" — é só cenário dentro do período
      maWindow,
      band,
      accuracy_rate: Number(out.accuracy_rate || 0),
      series: out.series || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch revenue forecast" });
  }
});

// ============================
// DEALS (CRM)
// ============================
app.get("/api/deals", async (req, res) => {
  try {
    const { dateStart, dateEnd, limit } = req.query;

    // defaults seguros
    const start = dateStart || daysAgoISO(30);
    const end = dateEnd || todayISO();

    // limite controlado
    const lim = Math.min(Number(limit || 5000), 20000);

    const query = `
      SELECT *
      FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__deals\`
      WHERE DATE(COALESCE(win_at, created_at)) BETWEEN DATE(@start) AND DATE(@end)
      ORDER BY COALESCE(win_at, created_at) DESC
      LIMIT @lim
    `;

    const [rows] = await bigquery.query({
      query,
      params: { start, end, lim },
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

// ============================
// CONTACTS (Marketing)
// ============================
app.get("/api/contacts", async (req, res) => {
  try {
    const { dateStart, dateEnd, limit } = req.query;

    const start = dateStart || daysAgoISO(30);
    const end = dateEnd || todayISO();
    const lim = Math.min(Number(limit || 5000), 20000);

    const query = `
      SELECT *
      FROM \`${process.env.BQ_PROJECT_ID}.${DATASET}.rd_station__contacts\`
      WHERE DATE(created_at) BETWEEN DATE(@start) AND DATE(@end)
      ORDER BY created_at DESC
      LIMIT @lim
    `;

    const [rows] = await bigquery.query({
      query,
      params: { start, end, lim },
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// ===== Start (Cloud Run friendly)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
