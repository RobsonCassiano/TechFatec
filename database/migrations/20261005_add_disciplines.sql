CREATE TABLE IF NOT EXISTS disciplines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_disciplines_name (name),
    KEY ix_disciplines_active_name (active, name)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


ALTER TABLE study_groups
    ADD COLUMN discipline_id BIGINT UNSIGNED NULL AFTER id,
    ADD KEY ix_study_groups_discipline (discipline_id),
    ADD CONSTRAINT fk_study_groups_discipline
        FOREIGN KEY (discipline_id)
        REFERENCES disciplines (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;
