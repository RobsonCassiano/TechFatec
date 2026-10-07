ALTER TABLE materials
    ADD COLUMN original_file_name VARCHAR(255) NULL AFTER storage_key,
    ADD COLUMN mime_type VARCHAR(127) NULL AFTER original_file_name,
    ADD COLUMN file_size BIGINT UNSIGNED NULL AFTER mime_type;

ALTER TABLE activity_submissions
    ADD COLUMN storage_key VARCHAR(1024) NULL AFTER submitted_at,
    ADD COLUMN original_file_name VARCHAR(255) NULL AFTER storage_key,
    ADD COLUMN mime_type VARCHAR(127) NULL AFTER original_file_name,
    ADD COLUMN file_size BIGINT UNSIGNED NULL AFTER mime_type;
