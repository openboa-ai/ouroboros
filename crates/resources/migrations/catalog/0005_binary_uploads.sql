-- The admitted target and shared Core budget bound size. Catalog records the actual declared
-- integer size; the former fixture-specific 64 KiB ceiling does not describe binary transfers.
ALTER TABLE upload_staging DROP CONSTRAINT upload_staging_declared_size_check;
ALTER TABLE upload_staging ADD CONSTRAINT upload_staging_declared_size_check CHECK(declared_size >= 0);
