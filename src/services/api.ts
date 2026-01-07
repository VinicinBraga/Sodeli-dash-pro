const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

export const api = {
  async getOverview(params: {
    dateStart?: string;
    dateEnd?: string;
    platform?: string;
  }) {
    const qs = new URLSearchParams();
    if (params.dateStart) qs.set("dateStart", params.dateStart);
    if (params.dateEnd) qs.set("dateEnd", params.dateEnd);
    if (params.platform) qs.set("platform", params.platform);

    const res = await fetch(`${BASE_URL}/api/overview?${qs.toString()}`);
    if (!res.ok) {
      throw new Error(`Overview request failed: ${res.status}`);
    }
    return res.json();
  },

  async getDeals() {
    const res = await fetch(`${BASE_URL}/api/deals`);
    if (!res.ok) {
      throw new Error(`Deals request failed: ${res.status}`);
    }
    return res.json();
  },

  async getContacts() {
    const res = await fetch(`${BASE_URL}/api/contacts`);
    if (!res.ok) {
      throw new Error(`Contacts request failed: ${res.status}`);
    }
    return res.json();
  },
};
