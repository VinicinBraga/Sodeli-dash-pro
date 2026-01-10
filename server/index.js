const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { BigQuery } = require("@google-cloud/bigquery");

const app = express();
const PORT = process.env.PORT || 8080;

// ===== CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://SEU-PROJETO.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET"],
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

    const total = rows.reduce(
      (acc, r) => {
        acc.leads += r.leads || 0;
        acc.qualified_leads += r.qualified_leads || 0;
        acc.opportunities += r.opportunities || 0;
        acc.sales += r.sales || 0;
        acc.spend += r.spend || 0;
        acc.clicks += r.clicks || 0;
        acc.impressions += r.impressions || 0;
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

    res.json({ total, platforms: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// ============================
// DEALS (CRM)
// ============================
app.get("/api/deals", async (req, res) => {
  try {
    const { dateStart, dateEnd, limit } = req.query;

    // defaults seguros (mantém comportamento ok se frontend não mandar)
    const start = dateStart || daysAgoISO(30);
    const end = dateEnd || todayISO();

    // limite controlado (evita abuso)
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
