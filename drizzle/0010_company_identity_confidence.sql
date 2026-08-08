-- Entity-level identity confidence.
-- 100 = exact identity (source profile / relationship evidence)
-- 90  = normalized match (BOL name normalization)
-- 70  = fuzzy candidate (possible duplicate pair, or search-page-only evidence)
-- <70 = unresolved (name-only row)
ALTER TABLE `importyeti_web_entities` ADD `identity_confidence` integer;
ALTER TABLE `importyeti_web_entities` ADD `identity_notes` text;
