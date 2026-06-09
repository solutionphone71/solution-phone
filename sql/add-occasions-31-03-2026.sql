-- /sql/add-occasions-31-03-2026.sql
-- Ajoute les 17 smartphones d'occasion à l'inventaire 31/03/2026
-- Source : extraction Supabase phones au 31/03/2026
-- Total Section 3 : 4 994,98 €
-- Nouveau total inventaire : 29 774,98 €

DO $$
DECLARE inv_id bigint;
BEGIN
  -- Récupère l'ID de l'inventaire 31/03/2026
  SELECT id INTO inv_id
  FROM inventaires
  WHERE date_inventaire = '2026-03-31'
    AND source_file = 'inventaire-31-03-2026.xlsx'
  ORDER BY id DESC LIMIT 1;

  IF inv_id IS NULL THEN
    RAISE EXCEPTION 'Inventaire 31/03/2026 introuvable. Exécute d''abord seed-inventaire-31-03-2026.sql';
  END IF;

  -- Supprime les anciennes lignes section 3 si présentes
  DELETE FROM inventaire_items WHERE inventaire_id = inv_id AND section = 3;

  -- Insère les 17 modèles d'occasion
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES
    (inv_id, 3, 'Occasions', 'IPHONE 14 PRO MAX',     2, 385.00, 770.00,   1000),
    (inv_id, 3, 'Occasions', 'IPHONE 15 PRO MAX',     1, 600.00, 600.00,   1001),
    (inv_id, 3, 'Occasions', 'Iphone 15',             2, 290.00, 580.00,   1002),
    (inv_id, 3, 'Occasions', 'Samsung S24',           2, 265.00, 530.00,   1003),
    (inv_id, 3, 'Occasions', 'IPHONE 13 PRO MAX',     1, 355.00, 355.00,   1004),
    (inv_id, 3, 'Occasions', 'IPHONE 13',             1, 335.00, 335.00,   1005),
    (inv_id, 3, 'Occasions', 'S23 Ultra',             1, 300.00, 300.00,   1006),
    (inv_id, 3, 'Occasions', 'IPHONE 14 pro',         1, 300.00, 300.00,   1007),
    (inv_id, 3, 'Occasions', 'iPhone 13 pro',         1, 200.00, 200.00,   1008),
    (inv_id, 3, 'Occasions', 'SAMSUNG S22 ultra',     1, 169.98, 169.98,   1009),
    (inv_id, 3, 'Occasions', 'iPhone 12 PRO MAX',     1, 160.00, 160.00,   1010),
    (inv_id, 3, 'Occasions', 'SAMSUNG S21',           1, 155.00, 155.00,   1011),
    (inv_id, 3, 'Occasions', 'HONOR MAGIC 8 LITE',    1, 150.00, 150.00,   1012),
    (inv_id, 3, 'Occasions', 'iPhone 14 Pro (2e)',    1, 130.00, 130.00,   1013),
    (inv_id, 3, 'Occasions', 'iPhone 12',             1, 130.00, 130.00,   1014),
    (inv_id, 3, 'Occasions', 'iphone 11',             1,  80.00,  80.00,   1015),
    (inv_id, 3, 'Occasions', 'IPHONE 8 PLUS',         1,  50.00,  50.00,   1016);

  -- Recalcule total_section3 et total_ht de l'inventaire
  UPDATE inventaires
  SET
    total_section3 = (SELECT COALESCE(SUM(montant_ht),0) FROM inventaire_items WHERE inventaire_id = inv_id AND section = 3),
    total_ht       = (SELECT COALESCE(SUM(montant_ht),0) FROM inventaire_items WHERE inventaire_id = inv_id),
    updated_at     = now()
  WHERE id = inv_id;

  RAISE NOTICE 'Inventaire % mis à jour. 17 occasions ajoutées (4994,98 €).', inv_id;
END $$;

-- Vérification
SELECT
  i.id,
  i.date_inventaire,
  i.nom,
  i.total_section1 AS "accessoires",
  i.total_section2 AS "neufs",
  i.total_section3 AS "occasions",
  i.total_ht       AS "TOTAL HT",
  (SELECT COUNT(*) FROM inventaire_items WHERE inventaire_id = i.id) AS nb_items
FROM inventaires i
WHERE i.date_inventaire = '2026-03-31'
  AND i.source_file = 'inventaire-31-03-2026.xlsx';
