// Reports that combine both stores:
//   GET /api/reports/heart-rate-alerts?hours=24   rule-based anomalies in the Redis sensor stream,
//                                                 with limits taken from the MySQL profile (date of birth)
//   GET /api/reports/weekly?end=YYYY-MM-DD        seven-day summary: MySQL sessions, habits, schedule, goals
//                                                 + Redis daily totals and heart-rate alerts (UTC days)
const router = require('express').Router();
const pool = require('../config/mysql');
const memuraiClient = require('../config/memurai');
const auth = require('../middleware/auth');
const { validDate } = require('../utils/validation');
const { heartRateLimits, classifyReading } = require('../utils/heartRate');
router.use(auth);

const run = (handler) => async (req, res, next) => {
    try { await handler(req, res); } catch (error) { next(error); }
};
const DAY = 24 * 3600 * 1000;
const PAGE = 5000;
const MAX_READINGS = 150000;    // about a week of readings for one user at one every 5 s
const MAX_LISTED = 50;
const TYPES = ['high', 'elevated_resting', 'low'];
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const prevId = (id) => {
    const [ms, seq] = String(id).split('-');
    return Number(seq) > 0 ? `${ms}-${Number(seq) - 1}` : `${Number(ms) - 1}-18446744073709551615`;
};

async function limitsFor(userId) {
    const [rows] = await pool.query(
        "SELECT DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dob FROM user_profiles WHERE user_id = ?", [userId]);
    return heartRateLimits(rows[0]?.dob || null);
}

// Walks the stream newest-first between two times and applies the rules to every reading.
async function scanAlerts(userId, fromMs, toMs, limits) {
    const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
    const byDay = {};
    const alerts = [];
    let readings = 0, truncated = false, end = String(toMs);
    while (true) {
        const page = await memuraiClient.xRevRange(`fittrack:sensors:${userId}`, end, String(fromMs), { COUNT: PAGE });
        if (!page || page.length === 0) break;
        for (const entry of page) {
            readings += 1;
            const type = classifyReading(entry.message, limits);
            if (!type) continue;
            const t = Date.parse(entry.message.timestamp) || Number(entry.id.split('-')[0]);
            counts[type] += 1;
            byDay[utcDay(t)] = (byDay[utcDay(t)] || 0) + 1;
            if (alerts.length < MAX_LISTED) {
                alerts.push({
                    timestamp: new Date(t).toISOString(),
                    heart_rate: Number(entry.message.heart_rate),
                    activity_state: entry.message.activity_state || 'unknown',
                    type
                });
            }
        }
        if (readings >= MAX_READINGS) { truncated = true; break; }
        if (page.length < PAGE) break;
        end = prevId(page[page.length - 1].id);
    }
    const total = TYPES.reduce((sum, t) => sum + counts[t], 0);
    return { readings, counts, total, byDay, alerts, truncated };
}

router.get('/heart-rate-alerts', run(async (req, res) => {
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours, 10) || 24));
    const to = Date.now();
    const from = to - hours * 3600 * 1000;
    const limits = await limitsFor(req.user.id);
    const scan = await scanAlerts(req.user.id, from, to, limits);
    res.json({
        window_hours: hours,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        limits,
        readings_checked: scan.readings,
        total_alerts: scan.total,
        counts: scan.counts,
        alerts: scan.alerts,
        truncated: scan.truncated
    });
}));

router.get('/weekly', run(async (req, res) => {
    const today = utcDay(Date.now());
    const end = req.query.end || today;
    if (!validDate(end) || end > today) return res.status(400).json({ error: 'Choose a valid week-ending date that is not in the future' });
    const endMs = Date.parse(`${end}T00:00:00Z`);
    const start = utcDay(endMs - 6 * DAY);
    const dates = Array.from({ length: 7 }, (_, i) => utcDay(endMs - (6 - i) * DAY));
    const userId = req.user.id;

    // Sessions are stored with the MySQL server's local NOW(); shift them to UTC so they line up with Redis days.
    const utcDate = "DATE_FORMAT(DATE(s.start_time - INTERVAL TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) SECOND), '%Y-%m-%d')";
    const [[sessions], [checkins], [habits], [[scheduled]], [goals], limits] = await Promise.all([
        pool.query(`SELECT ${utcDate} AS day, COUNT(*) AS workouts,
                COALESCE(SUM(s.duration_min), 0) AS minutes, COALESCE(SUM(s.volume_kg), 0) AS volume_kg
            FROM v_session_summary s
            WHERE s.user_id = ? AND s.end_time IS NOT NULL
              AND s.start_time >= DATE_SUB(?, INTERVAL 1 DAY) AND s.start_time < DATE_ADD(?, INTERVAL 2 DAY)
            GROUP BY day HAVING day BETWEEN ? AND ?`, [userId, start, end, start, end]),
        pool.query(`SELECT DATE_FORMAT(c.checkin_date, '%Y-%m-%d') AS day, COUNT(*) AS checkins
            FROM habit_checkins c JOIN habits h ON h.id = c.habit_id
            WHERE h.user_id = ? AND c.checkin_date BETWEEN ? AND ?
            GROUP BY c.checkin_date`, [userId, start, end]),
        pool.query(`SELECT h.id, h.name, COUNT(c.habit_id) AS days_completed
            FROM habits h LEFT JOIN habit_checkins c
              ON c.habit_id = h.id AND c.checkin_date BETWEEN ? AND ?
            WHERE h.user_id = ? GROUP BY h.id, h.name ORDER BY h.id`, [start, end, userId]),
        pool.query(`SELECT COUNT(*) AS planned FROM workout_schedule s JOIN workout_plans p ON p.id = s.plan_id
            WHERE p.user_id = ? AND s.scheduled_date BETWEEN ? AND ?`, [userId, start, end]),
        pool.query('SELECT status, COUNT(*) AS n FROM fitness_goals WHERE user_id = ? GROUP BY status', [userId]),
        limitsFor(userId)
    ]);
    const [daily, alerts] = await Promise.all([
        Promise.all(dates.map((d) => memuraiClient.hGetAll(`fittrack:activity:daily:${userId}:${d}`))),
        scanAlerts(userId, Date.parse(`${start}T00:00:00Z`), endMs + DAY - 1, limits)
    ]);

    const sessionBy = Object.fromEntries(sessions.map((r) => [r.day, r]));
    const checkinBy = Object.fromEntries(checkins.map((r) => [r.day, Number(r.checkins)]));
    const days = dates.map((date, i) => ({
        date,
        steps: Number(daily[i].total_steps || 0),
        calories: Math.round(Number(daily[i].total_calories || 0)),
        readings: Number(daily[i].reading_counts || 0),
        workouts: Number(sessionBy[date]?.workouts || 0),
        workout_minutes: Number(sessionBy[date]?.minutes || 0),
        volume_kg: Math.round(Number(sessionBy[date]?.volume_kg || 0)),
        habit_checkins: checkinBy[date] || 0,
        heart_rate_alerts: alerts.byDay[date] || 0
    }));
    const sum = (field) => days.reduce((total, d) => total + d[field], 0);
    const possible = habits.length * 7;
    res.json({
        start, end,
        days,
        totals: {
            steps: sum('steps'),
            calories: sum('calories'),
            workouts: sum('workouts'),
            workout_minutes: sum('workout_minutes'),
            volume_kg: sum('volume_kg'),
            habit_checkins: sum('habit_checkins'),
            habit_completion_pct: possible ? Math.round((sum('habit_checkins') / possible) * 1000) / 10 : null,
            scheduled_workouts: Number(scheduled.planned),
            heart_rate_alerts: alerts.total,
            active_days: days.filter((d) => d.readings > 0 || d.workouts > 0 || d.habit_checkins > 0).length
        },
        habits: habits.map((h) => ({ name: h.name, days_completed: Number(h.days_completed) })),
        goals: Object.fromEntries(goals.map((g) => [g.status, Number(g.n)])),
        alert_counts: alerts.counts,
        limits
    });
}));

module.exports = router;
