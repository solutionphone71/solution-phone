-- ════════════════════════════════════════════════════════════════
-- TEAM ZAHIRA · Seed agent_memory avec la composition de l'équipe
-- ════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase SQL Editor.
-- Permet à l'app de connaître les 5 agents et leur identité visuelle.
-- ════════════════════════════════════════════════════════════════

insert into agent_memory (key, value, description, updated_by) values
  (
    'team_zahira',
    '{
      "boss": {
        "name": "ZAHIRA",
        "label": "◢ ZAHIRA",
        "role": "La cheffe",
        "tagline": "Orchestre l''équipe et te présente la synthèse à valider",
        "color": "#e63946"
      },
      "workers": {
        "assya": {
          "name": "ASSYA",
          "label": "◢ ASSYA",
          "role": "Community Manager",
          "tagline": "L''éclair des réseaux",
          "color": "#ff6b35",
          "domains": ["instagram", "facebook", "google_business", "reviews"],
          "decision_types": ["post", "reel", "story", "reply_review", "reply_dm"]
        },
        "anissa": {
          "name": "ANISSA",
          "label": "◢ ANISSA",
          "role": "Compta",
          "tagline": "La sentinelle des chiffres",
          "color": "#2563eb",
          "domains": ["caisse", "tva", "pennylane", "marges"],
          "decision_types": ["alert", "report"]
        },
        "obiwan": {
          "name": "OBIWAN",
          "label": "◢ OBIWAN",
          "role": "Coach Boutique",
          "tagline": "Le sage maître Jedi",
          "color": "#7c3aed",
          "domains": ["stock", "employes", "boutiques"],
          "decision_types": ["challenge", "alert"]
        },
        "yago": {
          "name": "YAGO",
          "label": "◢ YAGO",
          "role": "QualiRépar",
          "tagline": "Le forgeron",
          "color": "#16a34a",
          "domains": ["qualirepar", "anre", "bonus", "reparations"],
          "decision_types": ["qualirepar_dossier", "post"]
        },
        "chanel": {
          "name": "CHANEL",
          "label": "◢ CHANEL",
          "role": "App Improver",
          "tagline": "L''œil affûté du luxe",
          "color": "#0891b2",
          "domains": ["app", "ux", "features", "bugs"],
          "decision_types": ["feature_idea", "alert"]
        }
      }
    }'::jsonb,
    'Composition de l''équipe Zahira (boss + 5 workers). Utilisé par l''UI Autopilot pour afficher les décisions groupées par agent.',
    'sebastien'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- ════════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ════════════════════════════════════════════════════════════════
select key, jsonb_pretty(value) as team
from agent_memory
where key = 'team_zahira';
