-- Raise case study PDF upload limit to 50 MB.
-- Run in Supabase SQL Editor after migration 016.

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'client-case-studies';
