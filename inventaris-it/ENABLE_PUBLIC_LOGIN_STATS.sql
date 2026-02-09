-- =========================================
-- ENABLE PUBLIC ACCESS FOR LOGIN PAGE STATS
-- Only enables tables needed for the landing page
-- =========================================

-- 1. ENABLE PUBLIC ACCESS TO perangkat
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'perangkat' 
        AND policyname = 'Public can view perangkat'
    ) THEN
        CREATE POLICY "Public can view perangkat"
        ON perangkat FOR SELECT
        TO anon, authenticated
        USING (true);
        RAISE NOTICE '✅ Created policy: Public can view perangkat';
    ELSE
        RAISE NOTICE '⏭️ Policy already exists: Public can view perangkat';
    END IF;
END $$;

-- 2. ENABLE PUBLIC ACCESS TO ms_jenis_perangkat
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ms_jenis_perangkat' 
        AND policyname = 'Public can view ms_jenis_perangkat'
    ) THEN
        CREATE POLICY "Public can view ms_jenis_perangkat"
        ON ms_jenis_perangkat FOR SELECT
        TO anon, authenticated
        USING (true);
        RAISE NOTICE '✅ Created policy: Public can view ms_jenis_perangkat';
    ELSE
        RAISE NOTICE '⏭️ Policy already exists: Public can view ms_jenis_perangkat';
    END IF;
END $$;

-- 3. ENABLE PUBLIC ACCESS TO ms_jenis_barang
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ms_jenis_barang' 
        AND policyname = 'Public can view ms_jenis_barang'
    ) THEN
        CREATE POLICY "Public can view ms_jenis_barang"
        ON ms_jenis_barang FOR SELECT
        TO anon, authenticated
        USING (true);
        RAISE NOTICE '✅ Created policy: Public can view ms_jenis_barang';
    ELSE
        RAISE NOTICE '⏭️ Policy already exists: Public can view ms_jenis_barang';
    END IF;
END $$;

-- 4. ENABLE PUBLIC ACCESS TO ms_lokasi
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ms_lokasi' 
        AND policyname = 'Public can view ms_lokasi'
    ) THEN
        CREATE POLICY "Public can view ms_lokasi"
        ON ms_lokasi FOR SELECT
        TO anon, authenticated
        USING (true);
        RAISE NOTICE '✅ Created policy: Public can view ms_lokasi';
    ELSE
        RAISE NOTICE '⏭️ Policy already exists: Public can view ms_lokasi';
    END IF;
END $$;

-- =========================================
-- VERIFICATION
-- =========================================
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('perangkat', 'ms_jenis_perangkat', 'ms_jenis_barang', 'ms_lokasi')
AND 'anon' = ANY(roles)
ORDER BY tablename;

-- =========================================
-- TEST QUERIES (run these to verify)
-- =========================================
-- SELECT COUNT(*) as total_perangkat FROM perangkat;
-- SELECT COUNT(*) as total_lokasi FROM ms_lokasi WHERE is_active = true;
-- SELECT kode, nama FROM ms_jenis_perangkat WHERE is_active = true;
-- SELECT kode, nama FROM ms_jenis_barang WHERE is_active = true;
