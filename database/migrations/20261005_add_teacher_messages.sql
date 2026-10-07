CREATE TABLE teacher_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    teacher_user_id BIGINT UNSIGNED NOT NULL,
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
