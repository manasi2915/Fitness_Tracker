// Uses a new disposable database, never resets fittrack_db or its records.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mysql = require('mysql2/promise');
const { splitStatements } = require('../../database/sqlRunner');
const database = `fittrack_test_${crypto.randomBytes(6).toString('hex')}`;
process.env.DB_NAME = database;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
let admin, pool, server;
let passed = 0;
async function main() {
    admin = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    for (const file of ['schema.sql', 'extensions.sql', 'programmability.sql']) {
        const sql = fs.readFileSync(path.join(__dirname, '../../database', file), 'utf8').replaceAll('fittrack_db', database);
        for (const statement of splitStatements(sql)) await admin.query(statement);
    }
    // Replay verifies additive migrations are repeatable.
    const { runSqlFile } = require('../../database/sqlRunner');
    await runSqlFile(admin, path.join(__dirname, '../../database/extensions.sql'));
    const hash = await require('bcrypt').hash('IntegrationOnly123!', 4);
    await admin.query("INSERT INTO users(name,email,password_hash,role) VALUES ('Member One','one@example.test',?,'member'),('Member Two','two@example.test',?,'member'),('Admin User','admin@example.test',?,'admin')", [hash, hash, hash]);
    await admin.query("INSERT INTO workout_plans(user_id,name) VALUES (1,'Own plan'),(2,'Other plan')");
    await admin.query("INSERT INTO exercises(name) VALUES ('Test exercise')");
    pool = require('../src/config/mysql');
    const express = require('express');
    const app = express(); app.use(express.json());
    app.use('/api/routine', require('../src/routes/routineRoutes'));
    app.use('/api/workouts', require('../src/routes/workoutRoutes'));
    app.use('/api/reports', require('../src/routes/reportRoutes'));
    app.use((err, req, res, next) => res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const token = require('jsonwebtoken').sign({ id: 1, email: 'one@example.test' }, process.env.JWT_SECRET);
    async function request(method, url, body, status = 200, authenticated = true) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, {
            method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const json = await response.json();
        assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(json)}`); passed++;
        return json;
    }
    await request('GET', '/routine', undefined, 401, false);
    const h = await request('POST', '/routine/habits', { name: 'Stretch' }, 201);
    await request('POST', '/routine/habits', { name: ' ' }, 400);
    await request('PUT', `/routine/habits/${h.id}/checkin`, { date: '2026-02-30', checked: true }, 400);
    await request('PUT', `/routine/habits/${h.id}/checkin`, { date: '2026-01-01', checked: true });
    await request('PUT', `/routine/habits/${h.id}/checkin`, { date: '2026-01-01', checked: true });
    let r = await request('GET', '/routine?date=2026-01-01');
    assert.equal(r.habits[0].weekly_count, 1); assert.equal(r.habits[0].checked, 1);
    await admin.query("INSERT INTO habits(user_id,name) VALUES (2,'Private habit')");
    const [[otherHabit]] = await admin.query('SELECT id FROM habits WHERE user_id=2');
    await request('PUT', `/routine/habits/${otherHabit.id}/checkin`, { date: '2026-01-01', checked: true }, 404);
    await request('DELETE', `/routine/habits/${otherHabit.id}`, undefined, 404);
    await request('PUT', `/routine/habits/${h.id}/checkin`, { date: '2026-01-01', checked: false });
    r = await request('GET', '/routine?date=2026-01-01'); assert.equal(r.habits[0].weekly_count, 0);
    const schedule = await request('POST', '/routine/schedule', { plan_id: 1, scheduled_date: '2026-11-01' }, 201);
    await request('POST', '/routine/schedule', { plan_id: 1, scheduled_date: '2026-11-01' }, 409);
    await request('POST', '/routine/schedule', { plan_id: 2, scheduled_date: '2026-11-01' }, 404);
    await request('POST', '/workouts/sessions', { plan_id: 2 }, 404);
    await request('DELETE', `/routine/schedule/${schedule.id}`);
    await request('PUT', '/routine/coaches/1/subscription', { subscribed: true });
    await request('PUT', '/routine/coaches/1/subscription', { subscribed: true });
    r = await request('GET', '/routine'); assert.equal(r.coaches[0].subscribed, 1);
    await request('PUT', '/routine/coaches/1/subscription', { subscribed: false });
    await request('DELETE', `/routine/habits/${h.id}`);
    await reportChecks(request);
    // Database checks, transaction rollback, trigger, function and procedure.
    await assert.rejects(admin.query("INSERT INTO habits(user_id,name) VALUES (1,'')"), e => e.code === 'ER_CHECK_CONSTRAINT_VIOLATED'); passed++;
    await assert.rejects(admin.query("INSERT INTO habit_checkins VALUES (999999,'2026-01-01')"), e => e.code === 'ER_NO_REFERENCED_ROW_2'); passed++;
    await admin.beginTransaction(); await admin.query("INSERT INTO habits(user_id,name) VALUES (1,'Rollback')"); await admin.rollback();
    const [[count]] = await admin.query("SELECT COUNT(*) n FROM habits WHERE name='Rollback'"); assert.equal(count.n, 0); passed++;
    await admin.query("INSERT INTO fitness_goals(user_id,goal_type,target_value,start_date) VALUES (1,'weekly_workouts',1,CURDATE())");
    const session = await request('POST', '/workouts/sessions', { plan_id: 1 }, 201);
    await admin.query('INSERT INTO workout_sets(session_id,exercise_id,set_number,reps,weight,completed) VALUES (?,1,1,10,20,TRUE)', [session.id]);
    await request('PUT', `/workouts/sessions/${session.id}/end`);
    const [[goal]] = await admin.query('SELECT status FROM fitness_goals WHERE user_id=1'); assert.equal(goal.status, 'completed'); passed++;
    const [[volume]] = await admin.query('SELECT fn_session_volume(?) volume', [session.id]); assert.equal(Number(volume.volume), 200); passed++;
    await assert.rejects(admin.query('INSERT INTO workout_sets(session_id,exercise_id,set_number) VALUES (?,1,2)', [session.id]), e => e.sqlState === '45000'); passed++;
    await admin.query("CALL sp_change_role(3,2,'admin')");
    const [[audit]] = await admin.query('SELECT COUNT(*) n FROM role_audit_log'); assert.equal(audit.n, 1); passed++;
    await assert.rejects(admin.query("CALL sp_change_role(1,2,'member')"), e => e.sqlState === '45000'); passed++;
    console.log(`PASS: ${passed} API/database checks; isolated schema, repeat migration, ownership, validation, check-ins, schedules, subscriptions, weekly report and heart-rate alerts across MySQL and Redis, rollback, triggers, function and role procedure.`);
}
// Weekly report and heart-rate alerts for a separate user whose Redis keys are written here and removed afterwards.
const REPORT_USER = 987654321;
const redisKeys = [];
async function reportChecks(request) {
    redis = require('../src/config/memurai');
    try { await redis.ping(); } catch { console.log('SKIP: report checks need Redis running'); return; }
    await request('GET', '/reports/weekly', undefined, 401, false);
    const { heartRateLimits } = require('../src/utils/heartRate');
    await admin.query("INSERT INTO users(id,name,email,password_hash,role) VALUES (?,'Report User','report@example.test','x','member')", [REPORT_USER]);
    await admin.query("INSERT INTO user_profiles(user_id,date_of_birth) VALUES (?,'1996-01-01')", [REPORT_USER]);
    const limits = heartRateLimits('1996-01-01');
    await admin.query("INSERT INTO workout_plans(user_id,name) VALUES (?,'Report plan')", [REPORT_USER]);
    const [[plan]] = await admin.query('SELECT id FROM workout_plans WHERE user_id=?', [REPORT_USER]);
    const [session] = await admin.query('INSERT INTO workout_sessions(user_id,plan_id,start_time) VALUES (?,?,NOW() - INTERVAL 30 MINUTE)', [REPORT_USER, plan.id]);
    await admin.query('INSERT INTO workout_sets(session_id,exercise_id,set_number,reps,weight,completed) VALUES (?,1,1,10,20,TRUE)', [session.insertId]);
    await admin.query('UPDATE workout_sessions SET end_time = start_time + INTERVAL 20 MINUTE WHERE id=?', [session.insertId]);
    await admin.query("INSERT INTO habits(user_id,name) VALUES (?,'Report habit')", [REPORT_USER]);
    await admin.query('INSERT INTO habit_checkins SELECT id, UTC_DATE() FROM habits WHERE user_id=?', [REPORT_USER]);
    const stream = `fittrack:sensors:${REPORT_USER}`, today = new Date().toISOString().slice(0, 10);
    const daily = `fittrack:activity:daily:${REPORT_USER}:${today}`;
    redisKeys.push(stream, daily);
    const now = Date.now();
    const readings = [[limits.high_threshold + 5, 'exercising'], [110, 'resting'], [35, 'resting'], [80, 'resting']];
    for (const [i, [hr, state]] of readings.entries()) {
        const t = now - (readings.length - i) * 1000;
        await redis.xAdd(stream, `${t}-0`, { timestamp: new Date(t).toISOString(), heart_rate: String(hr), step_increment: '5', calories_burned: '1.2', activity_state: state });
    }
    await redis.hSet(daily, { total_steps: '500', total_calories: '20.5', reading_counts: '4' });
    const jwt = require('jsonwebtoken').sign({ id: REPORT_USER, email: 'report@example.test' }, process.env.JWT_SECRET);
    const as = async (url, status = 200) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { headers: { Authorization: `Bearer ${jwt}` } });
        assert.equal(response.status, status, url); passed++;
        return response.json();
    };
    const alerts = await as('/reports/heart-rate-alerts?hours=1');
    assert.equal(alerts.readings_checked, 4);
    assert.deepEqual(alerts.counts, { high: 1, elevated_resting: 1, low: 1 });
    assert.equal(alerts.limits.max_heart_rate, limits.max_heart_rate); passed++;
    const week = await as('/reports/weekly');
    assert.equal(week.days.length, 7);
    assert.deepEqual([week.totals.steps, week.totals.workouts, week.totals.volume_kg, week.totals.habit_checkins, week.totals.habit_completion_pct, week.totals.heart_rate_alerts],
        [500, 1, 200, 1, 14.3, 3]); passed++;
    await as('/reports/weekly?end=2999-01-01', 400);
    await as('/reports/weekly?end=2026-02-30', 400);
    const own = await request('GET', '/reports/weekly');   // user 1 must not see the report user's data
    assert.deepEqual([own.totals.workouts, own.totals.habit_checkins], [0, 0]); passed++;
}
let redis;

main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (redis?.isOpen) { if (redisKeys.length) await redis.del(redisKeys); await redis.quit(); }
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); await admin.end(); }
});
