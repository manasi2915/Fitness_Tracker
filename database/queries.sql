-- =====================================================================
-- FitTrack - important queries (run after setup_mysql.js)
--   mysql -u ft_admin -p -h localhost fittrack_db < database/queries.sql
-- Each block is labelled with the SQL concept it demonstrates.
-- =====================================================================
USE fittrack_db;

-- 1. JOIN (INNER): a user's finished sessions with the plan name
SELECT s.id, s.start_time, s.end_time, p.name AS plan_name, s.notes
FROM workout_sessions s
JOIN workout_plans p ON s.plan_id = p.id
WHERE s.user_id = 4
ORDER BY s.start_time DESC;

-- 2. AGGREGATE (COUNT, SUM, GROUP BY) + user-defined FUNCTION fn_session_volume
SELECT session_id, COUNT(id) AS total_sets, SUM(reps * weight) AS total_volume_kg
FROM workout_sets
WHERE session_id = 1 AND completed = TRUE
GROUP BY session_id;

SELECT id AS session_id, user_id, fn_session_volume(id) AS volume_kg
FROM workout_sessions
ORDER BY volume_kg DESC;

-- 3. SUBQUERY (NOT IN) and the same question with a correlated NOT EXISTS
SELECT name, muscle_group FROM exercises
WHERE id NOT IN (SELECT exercise_id FROM plan_exercises);

SELECT e.name, e.muscle_group FROM exercises e
WHERE NOT EXISTS (SELECT 1 FROM plan_exercises pe WHERE pe.exercise_id = e.id);

-- 4. DATE-RANGE query (WHERE with date arithmetic)
SELECT id, start_time FROM workout_sessions
WHERE user_id = 1 AND start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 5. TRANSACTION (atomic: all or nothing) - the procedure-free equivalent of app registration
START TRANSACTION;
INSERT INTO workout_sessions (user_id, plan_id, start_time) VALUES (1, 1, NOW());
-- imagine the app crashes before the sets are written ...
ROLLBACK;                      -- the session row is NOT kept

-- 6. JOIN (1:1) users + profiles
SELECT u.id, u.name, u.email, u.role, u.last_login_at,
       p.date_of_birth, TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
       p.gender, p.height_cm, p.weight_kg, p.fitness_level
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
ORDER BY u.id;

-- 7. GROUP BY + HAVING (only users who have logged at least one session)
SELECT u.id, u.name,
       COUNT(DISTINCT s.id) AS sessions,
       COUNT(DISTINCT g.id) AS goals,
       COUNT(DISTINCT w.id) AS plans
FROM users u
LEFT JOIN workout_sessions s ON s.user_id = u.id
LEFT JOIN fitness_goals g   ON g.user_id = u.id
LEFT JOIN workout_plans w   ON w.user_id = u.id
GROUP BY u.id, u.name
HAVING COUNT(DISTINCT s.id) >= 1
ORDER BY sessions DESC, u.name;

-- 8. NESTED query (3 levels): members with an ACTIVE goal whose average session volume
--    beats the average across ALL finished sessions.
SELECT u.id, u.name, t.avg_volume_kg
FROM users u
JOIN (
    SELECT x.user_id, AVG(x.volume_kg) AS avg_volume_kg
    FROM (SELECT s.user_id, fn_session_volume(s.id) AS volume_kg
          FROM workout_sessions s
          WHERE s.end_time IS NOT NULL) x
    GROUP BY x.user_id
) t ON t.user_id = u.id
WHERE EXISTS (SELECT 1 FROM fitness_goals g WHERE g.user_id = u.id AND g.status = 'active')
  AND t.avg_volume_kg > (SELECT AVG(y.volume_kg)
                         FROM (SELECT fn_session_volume(s2.id) AS volume_kg
                               FROM workout_sessions s2
                               WHERE s2.end_time IS NOT NULL) y)
ORDER BY t.avg_volume_kg DESC;

-- 9. CORRELATED subquery: sessions that beat that same user's own average session
SELECT s.id, s.user_id, fn_session_volume(s.id) AS volume_kg
FROM workout_sessions s
WHERE s.end_time IS NOT NULL
  AND fn_session_volume(s.id) > (SELECT AVG(fn_session_volume(s2.id))
                                 FROM workout_sessions s2
                                 WHERE s2.user_id = s.user_id AND s2.end_time IS NOT NULL);

-- 10. CTE (WITH): weekly-style leaderboard by total lifted volume
WITH session_volume AS (
    SELECT s.id AS session_id, s.user_id, SUM(ws.reps * ws.weight) AS volume_kg
    FROM workout_sessions s
    JOIN workout_sets ws ON ws.session_id = s.id AND ws.completed = TRUE
    GROUP BY s.id, s.user_id
),
user_totals AS (
    SELECT user_id, COUNT(*) AS sessions_with_sets, SUM(volume_kg) AS total_volume_kg
    FROM session_volume
    GROUP BY user_id
)
SELECT u.name, t.sessions_with_sets, t.total_volume_kg,
       RANK() OVER (ORDER BY t.total_volume_kg DESC) AS volume_rank
FROM user_totals t
JOIN users u ON u.id = t.user_id
ORDER BY volume_rank;

-- 11. RECURSIVE CTE: a calendar of the last 7 days, with finished sessions per day for user 4
WITH RECURSIVE calendar AS (
    SELECT CURDATE() - INTERVAL 6 DAY AS day
    UNION ALL
    SELECT day + INTERVAL 1 DAY FROM calendar WHERE day < CURDATE()
)
SELECT c.day, COUNT(s.id) AS finished_sessions
FROM calendar c
LEFT JOIN workout_sessions s
       ON DATE(s.start_time) = c.day AND s.user_id = 4 AND s.end_time IS NOT NULL
GROUP BY c.day
ORDER BY c.day;

-- 12. ORDER BY + LIMIT: the three most-trained exercises (completed sets)
SELECT e.name, e.muscle_group, COUNT(ws.id) AS completed_sets
FROM workout_sets ws
JOIN exercises e ON e.id = ws.exercise_id
WHERE ws.completed = TRUE
GROUP BY e.id, e.name, e.muscle_group
ORDER BY completed_sets DESC, e.name
LIMIT 3;

-- 13. VIEWS: the member-facing summaries are simple SELECTs
SELECT * FROM v_user_directory ORDER BY id;
SELECT * FROM v_session_summary ORDER BY session_id;

-- 14. INDEX usage: the composite index idx_user_sessions(user_id, start_time) is used here
EXPLAIN SELECT id, start_time FROM workout_sessions
WHERE user_id = 1 AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY);

-- =====================================================================
-- Queries on the synopsis tables (habits, habit_checkins, workout_schedule,
-- coaches, subscriptions - see extensions.sql). "Today" is UTC, as in the app.
-- =====================================================================

-- 15. RECURSIVE CTE: each habit's streak - consecutive days of check-ins ending at its latest check-in.
--     The anchor row is the latest check-in; each recursive step walks back one day while a check-in exists.
WITH RECURSIVE streak AS (
    SELECT c.habit_id, c.checkin_date AS day, 1 AS len
    FROM habit_checkins c
    WHERE c.checkin_date = (SELECT MAX(c2.checkin_date) FROM habit_checkins c2 WHERE c2.habit_id = c.habit_id)
    UNION ALL
    SELECT s.habit_id, c.checkin_date, s.len + 1
    FROM streak s
    JOIN habit_checkins c ON c.habit_id = s.habit_id AND c.checkin_date = s.day - INTERVAL 1 DAY
)
SELECT u.name AS member, h.name AS habit,
       MAX(s.len) AS streak_days,
       MAX(s.day) AS last_checkin,
       MAX(s.day) = UTC_DATE() AS done_today 
FROM streak s
JOIN habits h ON h.id = s.habit_id
JOIN users u ON u.id = h.user_id
GROUP BY u.name, h.id, h.name
ORDER BY streak_days DESC, member;

-- 16. LEFT JOIN + GROUP BY + HAVING + correlated subqueries: coaches with at least one subscriber,
--     and how consistently their subscribers kept their habits over the last 7 days.
SELECT co.name AS coach, co.specialty,
       COUNT(sub.user_id) AS subscribers,
       ROUND(100 * (SELECT COUNT(*)
                    FROM habit_checkins hc
                    JOIN habits h ON h.id = hc.habit_id
                    JOIN subscriptions s2 ON s2.user_id = h.user_id
                    WHERE s2.coach_id = co.id AND hc.checkin_date > UTC_DATE() - INTERVAL 7 DAY)
             / NULLIF(7 * (SELECT COUNT(*)
                           FROM habits h
                           JOIN subscriptions s3 ON s3.user_id = h.user_id
                           WHERE s3.coach_id = co.id), 0), 1) AS habit_completion_pct_7d
FROM coaches co
LEFT JOIN subscriptions sub ON sub.coach_id = co.id
GROUP BY co.id, co.name, co.specialty
HAVING COUNT(sub.user_id) >= 1
ORDER BY subscribers DESC, co.name;

-- 17. NOT EXISTS (anti-join): reminder list - habits nobody has checked in yet today.
SELECT u.name AS member, h.name AS habit
FROM habits h
JOIN users u ON u.id = h.user_id
WHERE NOT EXISTS (SELECT 1 FROM habit_checkins c
                  WHERE c.habit_id = h.id AND c.checkin_date = UTC_DATE())
ORDER BY member, habit;

-- 18. JOIN + GROUP BY + ORDER BY: workouts scheduled in the next 7 days, with the owner and plan size.
SELECT ws.scheduled_date, u.name AS member, p.name AS plan,
       COUNT(pe.id) AS exercises, COALESCE(SUM(pe.sets), 0) AS total_sets
FROM workout_schedule ws
JOIN workout_plans p ON p.id = ws.plan_id
JOIN users u ON u.id = p.user_id
LEFT JOIN plan_exercises pe ON pe.plan_id = p.id
WHERE ws.scheduled_date BETWEEN UTC_DATE() AND UTC_DATE() + INTERVAL 7 DAY
GROUP BY ws.id, ws.scheduled_date, u.name, p.name
ORDER BY ws.scheduled_date, member;

-- 19. Weekly report (as used by GET /api/reports/weekly): one row per member for the last 7 days,
--     combining the view v_session_summary (and fn_session_volume inside it) with habit check-ins.
--     Steps, calories and heart-rate alerts for the same days come from Redis and are merged by the API.
SELECT u.name AS member,
       (SELECT COUNT(*) FROM v_session_summary v
         WHERE v.user_id = u.id AND v.end_time IS NOT NULL
           AND v.start_time >= UTC_DATE() - INTERVAL 6 DAY) AS workouts_7d,
       (SELECT COALESCE(SUM(v.volume_kg), 0) FROM v_session_summary v
         WHERE v.user_id = u.id AND v.end_time IS NOT NULL
           AND v.start_time >= UTC_DATE() - INTERVAL 6 DAY) AS volume_kg_7d,
       COUNT(c.habit_id) AS habit_checkins_7d,
       ROUND(100 * COUNT(c.habit_id) / NULLIF(7 * (SELECT COUNT(*) FROM habits h2 WHERE h2.user_id = u.id), 0), 1) AS habit_completion_pct
FROM users u
LEFT JOIN habits h ON h.user_id = u.id
LEFT JOIN habit_checkins c ON c.habit_id = h.id AND c.checkin_date BETWEEN UTC_DATE() - INTERVAL 6 DAY AND UTC_DATE()
GROUP BY u.id, u.name
ORDER BY workouts_7d DESC, member;
