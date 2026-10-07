ALTER TABLE teacher_messages
    ADD COLUMN sender_role ENUM('student', 'teacher')
        NOT NULL DEFAULT 'student' AFTER teacher_user_id;
