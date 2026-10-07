-- Initial TechFatec schema for MySQL 8.0.16 or newer.
-- Select the target database before running this script.
-- Credentials must be supplied by the application environment, never stored here.

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile ENUM('student', 'teacher', 'manager') NOT NULL,
    status ENUM('active', 'pending', 'disabled') NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY ix_users_profile_status (profile, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_reset_tokens_hash (token_hash),
    KEY ix_password_reset_tokens_user_expiry (user_id, expires_at),
    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE disciplines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_disciplines_name (name),
    KEY ix_disciplines_active_name (active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_groups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    discipline_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    level ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
    modality ENUM('online', 'in_person', 'hybrid') NOT NULL,
    status ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_study_groups_discipline (discipline_id),
    KEY ix_study_groups_status_level (status, level),
    KEY ix_study_groups_status_modality (status, modality),
    KEY ix_study_groups_created_by (created_by_user_id),
    CONSTRAINT fk_study_groups_discipline
        FOREIGN KEY (discipline_id) REFERENCES disciplines (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_study_groups_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_themes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    theme VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_group_themes_group_theme (group_id, theme),
    KEY ix_group_themes_theme (theme),
    CONSTRAINT fk_group_themes_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    is_leader BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('active', 'pending', 'left') NOT NULL DEFAULT 'active',
    joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_group_memberships_group_user (group_id, user_id),
    KEY ix_group_memberships_user_status (user_id, status),
    CONSTRAINT chk_group_memberships_is_leader
        CHECK (is_leader IN (0, 1)),
    CONSTRAINT fk_group_memberships_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_group_memberships_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_mentors (
    group_id BIGINT UNSIGNED NOT NULL,
    teacher_user_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (group_id, teacher_user_id),
    KEY ix_group_mentors_teacher (teacher_user_id),
    CONSTRAINT fk_group_mentors_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_group_mentors_teacher
        FOREIGN KEY (teacher_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teacher_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    teacher_user_id BIGINT UNSIGNED NOT NULL,
    sender_role ENUM('student', 'teacher') NOT NULL DEFAULT 'student',
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_teacher_messages_inbox (teacher_user_id, status, created_at),
    KEY ix_teacher_messages_student (student_user_id, created_at),
    CONSTRAINT fk_teacher_messages_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_teacher_messages_student
        FOREIGN KEY (student_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_teacher_messages_teacher
        FOREIGN KEY (teacher_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meetings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    starts_at DATETIME(3) NOT NULL,
    ends_at DATETIME(3) NOT NULL,
    modality ENUM('online', 'in_person', 'hybrid') NOT NULL,
    location_or_url VARCHAR(2048) NULL,
    status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_meetings_group_start (group_id, starts_at),
    KEY ix_meetings_status_start (status, starts_at),
    CONSTRAINT chk_meetings_time_range
        CHECK (ends_at > starts_at),
    CONSTRAINT fk_meetings_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meeting_attendance (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    meeting_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    attendance_status ENUM('present', 'absent', 'justified') NOT NULL,
    recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_meeting_attendance_meeting_user (meeting_id, user_id),
    KEY ix_meeting_attendance_user_status (user_id, attendance_status),
    CONSTRAINT fk_meeting_attendance_meeting
        FOREIGN KEY (meeting_id) REFERENCES meetings (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_meeting_attendance_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(40) NOT NULL,
    description TEXT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(127) NULL,
    file_size BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_materials_group_created (group_id, created_at),
    KEY ix_materials_group_type (group_id, type),
    KEY ix_materials_uploaded_by (uploaded_by_user_id),
    CONSTRAINT fk_materials_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_materials_uploaded_by
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    due_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_activities_group_due (group_id, due_at),
    KEY ix_activities_created_by (created_by_user_id),
    CONSTRAINT fk_activities_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_activities_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    activity_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'submitted', 'completed', 'late') NOT NULL DEFAULT 'pending',
    submitted_at DATETIME(3) NULL,
    storage_key VARCHAR(1024) NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(127) NULL,
    file_size BIGINT UNSIGNED NULL,
    feedback TEXT NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_activity_submissions_activity_user (activity_id, user_id),
    KEY ix_activity_submissions_user_status (user_id, status),
    CONSTRAINT fk_activity_submissions_activity
        FOREIGN KEY (activity_id) REFERENCES activities (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_activity_submissions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE projects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('planning', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'planning',
    starts_on DATE NULL,
    ends_on DATE NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_projects_group_status (group_id, status),
    KEY ix_projects_created_by (created_by_user_id),
    CONSTRAINT chk_projects_date_range
        CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
    CONSTRAINT fk_projects_group
        FOREIGN KEY (group_id) REFERENCES study_groups (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_projects_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    member_role VARCHAR(80) NULL,
    joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_project_members_project_user (project_id, user_id),
    KEY ix_project_members_user (user_id),
    CONSTRAINT fk_project_members_project
        FOREIGN KEY (project_id) REFERENCES projects (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_project_members_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
