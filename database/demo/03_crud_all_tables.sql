-- DEMO 5 - INSERT, UPDATE and DELETE on EVERY table (all 15: the 10 core tables and the 5 habit/schedule/coach tables).
-- Uses the id range 900+ so it never touches the real demo data.
-- The rows are removed again at the end (children first, so foreign keys are respected).
-- Run:  mysql -u ft_admin -p -h localhost fittrack_db < database/demo/03_crud_all_tables.sql
USE fittrack_db;

-- ===================== users =====================
INSERT INTO users (id, name, email, password_hash, role) VALUES
(900, 'CRUD Trainee', 'crud.test@fittrack.com', '$2b$10$qdQoM1jDfVsTF7EpIUShtO1aCD3AY/f1PlBAgyDwLn1LKim0Ir4l2', 'member');
UPDATE users SET name = 'CRUD Trainee (edited)' WHERE id = 900;

-- ===================== user_profiles =====================
INSERT INTO user_profiles (user_id, date_of_birth, gender, height_cm, weight_kg, fitness_level)
VALUES (900, '2000-06-15', 'non_binary', 170.0, 70.0, 'beginner');
UPDATE user_profiles SET weight_kg = 68.5 WHERE user_id = 900;

-- ===================== exercises =====================
INSERT INTO exercises (id, name, description, muscle_group, equipment_needed)
VALUES (900, 'CRUD Test Exercise', 'temporary row', 'Core', 'Bodyweight');
UPDATE exercises SET description = 'temporary row (edited)' WHERE id = 900;

-- ===================== workout_plans =====================
INSERT INTO workout_plans (id, user_id, name, description) VALUES (900, 900, 'CRUD Plan', 'temporary plan');
UPDATE workout_plans SET name = 'CRUD Plan (edited)' WHERE id = 900;

-- ===================== plan_exercises =====================
INSERT INTO plan_exercises (id, plan_id, exercise_id, sets, reps, target_weight, rest_seconds, exercise_order)
VALUES (900, 900, 900, 3, 10, 20.00, 60, 1);
UPDATE plan_exercises SET sets = 4 WHERE id = 900;

-- ===================== workout_sessions =====================
INSERT INTO workout_sessions (id, user_id, plan_id, start_time, notes)
VALUES (900, 900, 900, NOW(), 'CRUD session (still open)');
UPDATE workout_sessions SET notes = 'CRUD session (edited)' WHERE id = 900;

-- ===================== workout_sets =====================
-- allowed because session 900 is still open (trigger trg_sets_locked_session)
INSERT INTO workout_sets (id, session_id, exercise_id, set_number, reps, weight, completed)
VALUES (900, 900, 900, 1, 10, 20.00, TRUE);
UPDATE workout_sets SET reps = 12 WHERE id = 900;

-- ===================== fitness_goals =====================
INSERT INTO fitness_goals (id, user_id, goal_type, target_value, start_date, deadline, status)
VALUES (900, 900, 'daily_calories', 400, CURDATE(), NULL, 'active');
UPDATE fitness_goals SET target_value = 450 WHERE id = 900;

-- ===================== activity_log =====================
INSERT INTO activity_log (id, user_id, event_type, message)
VALUES (900, 900, 'SESSION_FINISHED', 'manual CRUD row');
UPDATE activity_log SET message = 'manual CRUD row (edited)' WHERE id = 900;

-- ===================== role_audit_log =====================
INSERT INTO role_audit_log (id, actor_id, target_user_id, old_role, new_role)
VALUES (900, 2, 900, 'member', 'admin');
UPDATE role_audit_log SET new_role = 'member' WHERE id = 900;   -- normally append-only; shown for CRUD completeness

-- ===================== habits =====================
INSERT INTO habits (id, user_id, name) VALUES (900, 900, 'CRUD habit');
UPDATE habits SET name = 'CRUD habit (edited)' WHERE id = 900;

-- ===================== habit_checkins (composite key: habit + date) =====================
INSERT INTO habit_checkins (habit_id, checkin_date) VALUES (900, CURDATE()), (900, CURDATE() - INTERVAL 1 DAY);
UPDATE habit_checkins SET checkin_date = CURDATE() - INTERVAL 2 DAY
WHERE habit_id = 900 AND checkin_date = CURDATE() - INTERVAL 1 DAY;

-- ===================== workout_schedule =====================
INSERT INTO workout_schedule (id, plan_id, scheduled_date) VALUES (900, 900, CURDATE() + INTERVAL 1 DAY);
UPDATE workout_schedule SET scheduled_date = CURDATE() + INTERVAL 2 DAY WHERE id = 900;

-- ===================== coaches =====================
INSERT INTO coaches (id, name, specialty) VALUES (900, 'CRUD Test Coach', 'temporary row');
UPDATE coaches SET specialty = 'temporary row (edited)' WHERE id = 900;

-- ===================== subscriptions (composite key: user + coach) =====================
INSERT INTO subscriptions (user_id, coach_id, started_on) VALUES (900, 900, CURDATE());
UPDATE subscriptions SET started_on = CURDATE() - INTERVAL 7 DAY WHERE user_id = 900 AND coach_id = 900;

-- ===================== verify, then DELETE in child-first order =====================
SELECT 'users' t, COUNT(*) rows_900 FROM users WHERE id = 900
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles WHERE user_id = 900
UNION ALL SELECT 'exercises', COUNT(*) FROM exercises WHERE id = 900
UNION ALL SELECT 'workout_plans', COUNT(*) FROM workout_plans WHERE id = 900
UNION ALL SELECT 'plan_exercises', COUNT(*) FROM plan_exercises WHERE id = 900
UNION ALL SELECT 'workout_sessions', COUNT(*) FROM workout_sessions WHERE id = 900
UNION ALL SELECT 'workout_sets', COUNT(*) FROM workout_sets WHERE id = 900
UNION ALL SELECT 'fitness_goals', COUNT(*) FROM fitness_goals WHERE id = 900
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log WHERE id = 900
UNION ALL SELECT 'role_audit_log', COUNT(*) FROM role_audit_log WHERE id = 900
UNION ALL SELECT 'habits', COUNT(*) FROM habits WHERE id = 900
UNION ALL SELECT 'habit_checkins', COUNT(*) FROM habit_checkins WHERE habit_id = 900
UNION ALL SELECT 'workout_schedule', COUNT(*) FROM workout_schedule WHERE id = 900
UNION ALL SELECT 'coaches', COUNT(*) FROM coaches WHERE id = 900
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions WHERE user_id = 900;

DELETE FROM subscriptions    WHERE user_id = 900 AND coach_id = 900;  -- before the coach (FK is ON DELETE RESTRICT)
DELETE FROM coaches          WHERE id = 900;
DELETE FROM workout_schedule WHERE id = 900;
DELETE FROM habit_checkins   WHERE habit_id = 900;
DELETE FROM habits           WHERE id = 900;

DELETE FROM role_audit_log   WHERE id = 900;
DELETE FROM activity_log     WHERE id = 900;
DELETE FROM workout_sets     WHERE id = 900;
DELETE FROM workout_sessions WHERE id = 900;
DELETE FROM plan_exercises   WHERE id = 900;
DELETE FROM workout_plans    WHERE id = 900;
DELETE FROM exercises        WHERE id = 900;
DELETE FROM fitness_goals    WHERE id = 900;
DELETE FROM user_profiles    WHERE user_id = 900;
DELETE FROM users            WHERE id = 900;

SELECT 'after delete - rows left for id 900' AS check_step,
       (SELECT COUNT(*) FROM users WHERE id = 900) + (SELECT COUNT(*) FROM exercises WHERE id = 900)
     + (SELECT COUNT(*) FROM coaches WHERE id = 900) + (SELECT COUNT(*) FROM habits WHERE id = 900) AS leftover;
