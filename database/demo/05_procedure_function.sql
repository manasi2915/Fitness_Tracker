-- DEMO 6 - stored FUNCTION and stored PROCEDURE (run as the admin account).
-- Run:  mysql -u ft_admin -p -h localhost fittrack_db < database/demo/05_procedure_function.sql
USE fittrack_db;

-- FUNCTION: lifted volume of one session
SELECT fn_session_volume(1) AS session_1_volume_kg;
----for multiple sessions
SELECT
    id AS session_id,
    fn_session_volume(id) AS volume_kg
FROM workout_sessions
WHERE end_time IS NOT NULL;
-- PROCEDURE: the admin (user 2) promotes Ravi (user 3) to admin, then reverts it
SELECT id, name, role FROM users WHERE id = 3;
CALL sp_change_role(2, 3, 'admin');
SELECT id, name, role FROM users WHERE id = 3;
CALL sp_change_role(2, 3, 'member');
SELECT id, name, role FROM users WHERE id = 3;

-- the audit trail written by the procedure
SELECT * FROM role_audit_log ORDER BY id DESC LIMIT 4;

-- rule inside the procedure: the last remaining admin cannot be demoted
-- EXPECTED TO FAIL with "Cannot demote the last remaining admin"
CALL sp_change_role(2, 2, 'member');
