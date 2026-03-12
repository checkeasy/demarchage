-- Auto-link existing prospects by company/organization name
DO $$
DECLARE
    ws RECORD;
    comp_rec RECORD;
    org_id UUID;
    extracted_domain TEXT;
BEGIN
    FOR ws IN SELECT id FROM public.workspaces LOOP
        FOR comp_rec IN
            SELECT
                lower(trim(COALESCE(p.organization, p.company))) AS norm_name,
                max(COALESCE(p.organization, p.company)) AS display_name,
                max(p.website) AS site,
                max(p.industry) AS industry,
                max(p.city) AS city,
                max(p.country) AS country
            FROM public.prospects p
            WHERE p.workspace_id = ws.id
              AND COALESCE(p.organization, p.company) IS NOT NULL
              AND trim(COALESCE(p.organization, p.company)) != ''
            GROUP BY lower(trim(COALESCE(p.organization, p.company)))
        LOOP
            extracted_domain := NULL;
            IF comp_rec.site IS NOT NULL THEN
                extracted_domain := regexp_replace(
                    lower(comp_rec.site),
                    '^https?://(www\.)?|/.*$', '', 'g'
                );
                IF extracted_domain = '' THEN extracted_domain := NULL; END IF;
            END IF;

            INSERT INTO public.organizations (workspace_id, name, website, domain, industry, city, country)
            VALUES (ws.id, comp_rec.display_name, comp_rec.site, extracted_domain, comp_rec.industry, comp_rec.city, comp_rec.country)
            ON CONFLICT (workspace_id, name) DO UPDATE SET
                website = COALESCE(EXCLUDED.website, public.organizations.website),
                domain = COALESCE(EXCLUDED.domain, public.organizations.domain)
            RETURNING id INTO org_id;

            UPDATE public.prospects p2
            SET organization_id = org_id
            WHERE p2.workspace_id = ws.id
              AND lower(trim(COALESCE(p2.organization, p2.company))) = comp_rec.norm_name
              AND p2.organization_id IS NULL;
        END LOOP;

        -- Recount
        UPDATE public.organizations o
        SET contact_count = (SELECT count(*) FROM public.prospects p WHERE p.organization_id = o.id)
        WHERE o.workspace_id = ws.id;
    END LOOP;
END $$;
