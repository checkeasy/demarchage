-- Add department column for French department filtering
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS department TEXT;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_prospects_department ON prospects (department) WHERE department IS NOT NULL;

-- Backfill: extract department from postal codes in location field
-- French postal codes are 5 digits, department = first 2 digits (or first 3 for DOM-TOM 97x)
UPDATE prospects
SET department = CASE
  WHEN (regexp_match(location, '\m(\d{5})\M'))[1] IS NOT NULL THEN
    CASE
      WHEN substring((regexp_match(location, '\m(\d{5})\M'))[1] from 1 for 2) = '97'
      THEN substring((regexp_match(location, '\m(\d{5})\M'))[1] from 1 for 3)
      ELSE substring((regexp_match(location, '\m(\d{5})\M'))[1] from 1 for 2)
    END
  ELSE NULL
END
WHERE location IS NOT NULL AND location != '' AND department IS NULL;

-- Also clean up the city column: extract actual city name from location
-- Pattern: "Ville (XXXXX)" -> "Ville"
UPDATE prospects
SET city = regexp_replace(location, '\s*\(\d{5}\)\s*$', '')
WHERE location ~ '^\S.*\(\d{5}\)$' AND (city IS NULL OR city = location);

-- Pattern: "XXXXX Ville" -> "Ville"
UPDATE prospects
SET city = trim(regexp_replace(location, '^\d{5}\s+', ''))
WHERE location ~ '^\d{5}\s+\S' AND length(regexp_replace(location, '^\d{5}\s+', '')) < 50
  AND (city IS NULL OR city = location);
