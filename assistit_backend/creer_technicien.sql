-- =====================================================================
--  Création manuelle d'un compte TECHNICIEN
-- ---------------------------------------------------------------------
--  L'inscription via l'application est réservée aux clients
--  (POST /auth/register renvoie 403 pour role = technicien).
--  Les comptes techniciens sont donc créés ici, par l'administrateur.
--
--  Exécution :
--    cd C:\Users\TCHEDRE\Desktop\Temp\AssistIT-main
--    docker exec -i assistit-postgres psql -U assistit -d assistit_db < assistit_backend\creer_technicien.sql
--
--  Vérification :
--    SELECT id, nom, email, role FROM users WHERE role = 'technicien';
-- =====================================================================

INSERT INTO users (nom, email, mot_de_passe, role, disponible)
VALUES (
  'Technicien Support',
  'technicien@assistit.dev',
  '$2b$10$otlTR9Tf4mlIIe9dxf6sNe5OjS415MzYN5PKsq4Z2t3OL6UAh1XqS',
  'technicien',
  true
)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role,
    mot_de_passe = EXCLUDED.mot_de_passe,
    disponible = true;

-- Identifiants :  technicien@assistit.dev  /  Tech@2026!
--
-- Pour changer le mot de passe, générer un nouveau hash :
--   cd assistit_backend
--   node -e "console.log(require('bcrypt').hashSync('NouveauMotDePasse', 10))"
-- puis remplacer la valeur entre quotes ci-dessus et relancer ce fichier.
