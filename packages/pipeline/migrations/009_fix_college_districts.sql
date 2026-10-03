-- 009_fix_college_districts.sql
-- Corrects four districts that scripts/generate-college-meta.mjs guessed wrongly from the college
-- name (these colleges are not on the FRA report, the usual source). The same fix is in
-- packages/pipeline/data/college-meta-2026.json, so a later full load gives the same values.
--   03012 VJTI, Matunga                          Mumbai-Suburban -> Mumbai-City
--   03036 Institute of Chemical Technology, Matunga  Mumbai-Suburban -> Mumbai-City
--   06725 New Satara College of Engg, Pandharpur  Satara -> Solapur
--   03465 Ideal Institute of Technology, Wada     Thane -> Palghar (Wada is in Palghar since 2014)

update college set district = 'Mumbai-City' where code in ('03012', '03036');
update college set district = 'Solapur' where code = '06725';
update college set district = 'Palghar' where code = '03465';
