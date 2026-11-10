-- Synopsis features. Additive and safe to apply to an existing database.
CREATE TABLE IF NOT EXISTS habits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_habit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_habit_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS habit_checkins (
    habit_id INT NOT NULL,
    checkin_date DATE NOT NULL,
    PRIMARY KEY (habit_id, checkin_date),
    CONSTRAINT fk_checkin_habit FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workout_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    scheduled_date DATE NOT NULL,
    CONSTRAINT fk_schedule_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
    UNIQUE KEY uq_plan_date (plan_id, scheduled_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS coaches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    specialty VARCHAR(100) NOT NULL,
    CONSTRAINT chk_coach_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id INT NOT NULL,
    coach_id INT NOT NULL,
    started_on DATE NOT NULL,
    PRIMARY KEY (user_id, coach_id),
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_coach FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Fictional catalogue; subscriptions record coaching enrolment, not payment.
INSERT INTO coaches (name, specialty) VALUES
    ('Demo Strength Coach', 'Strength and workout planning'),
    ('Demo Mobility Coach', 'Mobility and consistent daily habits')
ON DUPLICATE KEY UPDATE specialty = VALUES(specialty);
