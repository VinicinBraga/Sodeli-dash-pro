export type Platform = "google_ads" | "meta_ads" | "linkedin_ads" | "all";

/**
 * BigQuery (Node client) às vezes devolve campos como objeto { value: "..." }
 * em vez de string pura. Tipamos isso aqui para evitar "Invalid Date" e erros do TS.
 */
export type BQValue<T> = T | { value: T } | null | undefined;

export interface OverviewMetrics {
  total_users: number;
  visits: number;

  leads: number;
  qualified_leads: number;
  opportunities: number;
  sales: number;
  
  sales_crm: number;
  revenue_crm: number;
  
  spend: number;
  impressions: number;
  clicks: number;
  cpl: number;
  cpq: number; // Cost per Qualified
  cpo: number; // Cost per Opportunity
  cpv: number; // Cost per Sale (Venda)
  rate_leads_to_qualified: number;
  rate_qualified_to_opportunity: number;
  rate_opportunity_to_sale: number;
}

export interface DailyData {
  date: string;
  spend: number;
  leads: number;
}

export interface PlatformPerformance extends OverviewMetrics {
  platform: Platform;
  dailyHistory: DailyData[];
}

export interface Deal {
  id: string;

  // BigQuery pode devolver como string ou { value: string }
  win_at?: BQValue<string>; // or closed_at
  created_at: BQValue<string>;

  amount_total: number;
  organization_name: string;
  user_name: string; // Responsible
  email: string;
  phone?: string;

  // Origem pode vir como string ou { value: string } e às vezes null
  deal_source_name?: BQValue<string>;

  deal_stage_name: string;
  win: boolean;
}

export interface Contact {
  id: string;

  // Datas também podem vir como string ou { value: string }
  created_at: BQValue<string>;

  name: string;
  email: string;

  last_conversion_date?: BQValue<string>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FilterOptions {
  dateStart?: Date;
  dateEnd?: Date;
  platform?: Platform;
  search?: string;
  page?: number;
  pageSize?: number;
  type?: "won" | "opportunity" | "qualified";
}
