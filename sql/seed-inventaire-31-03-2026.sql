-- /sql/seed-inventaire-31-03-2026.sql
-- Pré-import de l'inventaire au 31 mars 2026 (xlsx de Sebastien)
-- À exécuter APRÈS create-inventaires.sql

-- Crée l'en-tête
INSERT INTO inventaires (date_inventaire, nom, statut, total_ht, total_section1, total_section2, total_section3, etabli_par, source_file)
VALUES ('2026-03-31', 'Inventaire au 31 mars 2026', 'validated', 24780.0, 21210.0, 3570.0, 0, 'Sébastien Cannard', 'inventaire-31-03-2026.xlsx')
RETURNING id AS inventaire_id;

-- Crée les lignes via DO block pour récupérer l'ID
DO $$
DECLARE inv_id bigint;
BEGIN
  SELECT id INTO inv_id FROM inventaires WHERE date_inventaire = '2026-03-31' AND source_file = 'inventaire-31-03-2026.xlsx' ORDER BY id DESC LIMIT 1;

  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 15 Pro Max — qualité OEM Original', 1.0, 286.0, 286.0, 0);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 14 Pro Max — qualité OEM', 1.0, 357.0, 357.0, 1);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 14 Pro — qualité OEM', 1.0, 367.0, 367.0, 2);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 14 — qualité LPTS Prime', 1.0, 567.0, 567.0, 3);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 13 — qualité LPTS Prime', 1.0, 567.0, 567.0, 4);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 12 — qualité LPTS', 1.0, 754.0, 754.0, 5);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone 11 — qualité HD ECO+', 1.0, 637.0, 637.0, 6);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone XR — qualité LPTS', 1.0, 478.0, 478.0, 7);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone XS Max — qualité OEM', 1.0, 147.0, 147.0, 8);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans iPhone', 'Écran iPhone SE 2/3 X ', 1.0, 423.0, 423.0, 9);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans Samsung', 'Écran Samsung Galaxy S', 1.0, 1157.0, 1157.0, 10);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Écrans Samsung', 'Écran Samsung Galaxy A', 1.0, 1540.0, 1540.0, 11);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone 14 15 16', 25.0, 8.0, 200.0, 12);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone 13', 20.0, 7.0, 140.0, 13);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone 12', 25.0, 7.0, 175.0, 14);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone 11', 30.0, 6.0, 180.0, 15);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone XR', 20.0, 6.0, 120.0, 16);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone X / XS', 15.0, 5.0, 75.0, 17);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie iPhone SE 2/3', 12.0, 5.0, 60.0, 18);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie Samsung Galaxy S22 / S23', 10.0, 20.0, 200.0, 19);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Batteries', 'Batterie Samsung Galaxy S21', 8.0, 20.0, 160.0, 20);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Connecteurs de charge (Lightning + USB-C, tous modèles)', 30.0, 8.0, 240.0, 21);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Vitres arrière iPhone 12-14', 20.0, 15.0, 300.0, 22);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Nappes de charge', 15.0, 12.0, 180.0, 23);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Caméras avant iPhone', 20.0, 20.0, 400.0, 24);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Caméras arrière iPhone', 15.0, 28.0, 420.0, 25);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Boutons home iPhone', 50.0, 4.0, 200.0, 26);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Lecteurs SIM', 40.0, 5.0, 200.0, 27);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Nappes power / volume', 30.0, 8.0, 240.0, 28);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Pièces détachées diverses', 'Joints d''étanchéité, visserie, petites pièces', 1.0, 320.0, 320.0, 29);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Coques silicone tous modèles', 750.0, 2.0, 1500.0, 30);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Coques renforcées anti-choc', 80.0, 5.0, 400.0, 31);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Verres trempés tous modèles', 1500.0, 0.7, 1050.0, 32);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Films hydrogel anti-casse', 100.0, 2.0, 200.0, 33);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Coques officielles Apple / Samsung', 40.0, 12.0, 480.0, 34);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Coques, films & protections', 'Coques fashion / designer', 2000.0, 2.5, 5000.0, 35);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Chargeurs USB-C 20W', 30.0, 12.0, 360.0, 36);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Chargeurs Lightning', 25.0, 9.0, 225.0, 37);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Câbles USB-C / Lightning', 50.0, 5.0, 250.0, 38);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Écouteurs filaires', 20.0, 6.0, 120.0, 39);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Écouteurs Bluetooth', 15.0, 25.0, 375.0, 40);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 1, 'Accessoires', 'Supports voiture / muraux', 20.0, 8.0, 160.0, 41);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Samsung', 'Samsung Galaxy S24 — 128 Go — Noir', 1.0, 690.0, 690.0, 42);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Samsung', 'Samsung Galaxy A55 5G — 256 Go — Bleu nuit', 1.0, 380.0, 380.0, 43);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Samsung', 'Samsung Galaxy A35 5G — 128 Go — Noir / Bleu', 2.0, 240.0, 480.0, 44);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Samsung', 'Samsung Galaxy A15 — 128 Go — Noir', 2.0, 150.0, 300.0, 45);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Samsung', 'Samsung Galaxy A05 — 64 Go — Noir / Argent', 2.0, 95.0, 190.0, 46);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Motorola', 'Motorola Razr 40 — 256 Go — Vert sauge', 1.0, 540.0, 540.0, 47);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Motorola', 'Motorola Edge 50 Fusion — 256 Go', 1.0, 320.0, 320.0, 48);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Motorola', 'Motorola Moto G84 — 256 Go', 1.0, 235.0, 235.0, 49);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Motorola', 'Motorola Moto G54 5G — 256 Go', 1.0, 175.0, 175.0, 50);
  INSERT INTO inventaire_items (inventaire_id, section, categorie, designation, quantite, pu_ht, montant_ht, order_index) VALUES (inv_id, 2, 'Motorola', 'Motorola Moto G34 — 128 Go', 2.0, 130.0, 260.0, 51);
END $$;

-- Vérification
SELECT i.id, i.date_inventaire, i.nom, i.total_ht, COUNT(it.id) AS nb_items FROM inventaires i LEFT JOIN inventaire_items it ON it.inventaire_id = i.id WHERE i.source_file = 'inventaire-31-03-2026.xlsx' GROUP BY i.id, i.date_inventaire, i.nom, i.total_ht;