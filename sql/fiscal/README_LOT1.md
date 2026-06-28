# CAISSE SÉCURISÉE v1.0 — Lot 1 (fondations) — Notice d'application

**Objectif du Lot 1 :** poser les fondations inaltérables, **sans toucher à l'activité** ni aux données existantes. Rien n'est encore branché sur la caisse — on crée seulement un schéma isolé et ses garde-fous.

> ⚠️ Préparation d'audit / architecture alignée ISCA. Aucune prétention de conformité légale sans audit externe.

## Ce que fait ce lot
- Crée un **schéma isolé `fiscal_cashier`** (séparé de tout le reste).
- Crée les **9 tables fiscales (vides)** + scaffold des rôles + registre de versions.
- Installe la **fonction de hash SHA-256** (chaînage calculé **en base**).
- Installe la **numérotation séquentielle atomique** (anti-doublon).
- Installe les **triggers d'immuabilité** : tout `UPDATE`/`DELETE` d'une écriture **finalisée** est **refusé** par PostgreSQL.
- Active **RLS deny-all** + **révoque l'accès** au schéma pour `anon`/`authenticated` (le proxy ouvert ne pourra jamais y toucher).

## Ce que ce lot NE fait PAS (volontairement)
- Ne crée aucune écriture, ne migre aucune donnée, ne modifie aucune table existante.
- Ne branche pas encore la caisse (ça commence au Lot 2 via l'API `/api/fiscal`).

## Pré-requis
1. **Confirmer le type de clé Supabase** (anon vs service_role) — voir Vercel → Settings → Environment Variables (`SUPABASE_KEY`) et Supabase → Project Settings → API. (N'impacte pas l'exécution du DDL, mais conditionne le Lot 2.)
2. Faire une **sauvegarde** Supabase avant toute migration (par principe), même si le Lot 1 n'altère rien d'existant.

## Application (dans l'ordre)
1. Supabase → **SQL Editor** → coller le contenu de **`lot1_up.sql`** → **Run**.
2. Coller **`lot1_tests.sql`** → **Run** → vérifier que les messages affichent **PASS 1..6** et que la requête RLS finale montre `true/true` partout. *(Les tests s'auto-annulent : aucune donnée de test ne reste.)*
3. C'est tout. Aucun impact visible côté boutique.

## Rollback (si besoin)
- Coller **`lot1_down.sql`** → **Run**. Cela **supprime le schéma `fiscal_cashier`** (vide au Lot 1) — **aucune autre donnée n'est touchée**.
- ⚠️ Ne PAS exécuter le rollback une fois des écritures fiscales réelles créées (Lots 2+).

## Fichiers livrés
- `lot1_up.sql` — migration (réversible)
- `lot1_down.sql` — rollback
- `lot1_tests.sql` — tests (auto-nettoyés)
- `README_LOT1.md` — cette notice

## Vérification rapide post-déploiement
```sql
-- Le schéma existe :
SELECT schema_name FROM information_schema.schemata WHERE schema_name='fiscal_cashier';
-- Les 9 tables + scaffolds existent :
SELECT tablename FROM pg_tables WHERE schemaname='fiscal_cashier' ORDER BY tablename;
-- La version est enregistrée :
SELECT fiscal_module_version, database_migration_version, deployed_at
FROM fiscal_cashier.fiscal_version_registry;
```

## Suite
- **Lot 2** : ledger + encaissements (`record_sale`, `record_payment`) via l'API `/api/fiscal`, en **double écriture** (l'app continue comme avant, on écrit AUSSI dans le ledger pour comparer avant bascule).
- Avant le Lot 2 : décision sur l'**authentification** (introduire Supabase Auth pour relier PIN → utilisateur/rôle).

*Aucun déploiement n'est fait automatiquement : vous appliquez le SQL après relecture.*
