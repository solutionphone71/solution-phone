// =============================================================================
// /api/google-reviews-config
// -----------------------------------------------------------------------------
// GET  → renvoie la config courante (lu par la modale)
// POST → met à jour la config
// =============================================================================

async function sb(path, { method = "GET", body } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await sb("google_reviews_config?id=eq.1&select=*");
      return res.status(200).json(rows?.[0] || {});
    }

    if (req.method === "POST") {
      const allowed = [
        "auto_publish_threshold",
        "sms_alert_threshold",
        "sms_alert_phone",
        "prompt_system",
        "signature_rotation",
        "enabled"
      ];
      const body = Object.fromEntries(
        Object.entries(req.body || {}).filter(([k]) => allowed.includes(k))
      );
      const updated = await sb("google_reviews_config?id=eq.1", {
        method: "PATCH",
        body
      });
      return res.status(200).json(updated?.[0] || {});
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
