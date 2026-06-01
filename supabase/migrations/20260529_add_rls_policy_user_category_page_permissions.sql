-- Add SELECT policy for authenticated users to read their category's page permissions
-- This fixes "Akses Ditolak" after login on desktop.
-- Root cause: RLS was enabled on user_category_page_permissions but no SELECT policy
-- existed for authenticated users, so the permission query returned empty data.

-- Step 1: Enable RLS (already enabled, but idempotent)
ALTER TABLE public.user_category_page_permissions ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy - allow authenticated users to view their own category's permissions
CREATE POLICY "Users can view their own category page permissions"
ON public.user_category_page_permissions
FOR SELECT
TO authenticated
USING (
  user_category_id IN (
    SELECT p.user_category_id 
    FROM public.profiles p 
    WHERE p.id = auth.uid()
  )
);
