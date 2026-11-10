const router = require('express').Router();
const pool = require('../config/mysql');
const auth = require('../middleware/auth');
const { validDate, positiveId } = require('../utils/validation');
router.use(auth);

const run = (handler) => async (req, res, next) => {
    try { await handler(req, res); } catch (error) { next(error); }
};
const day = (req) => req.query.date || new Date().toISOString().slice(0, 10);

router.get('/', run(async (req, res) => {
    const date = day(req);
    if (!validDate(date)) return res.status(400).json({ error: 'A valid date is required' });
    const [habits] = await pool.query(`SELECT h.id, h.name,
        EXISTS(SELECT 1 FROM habit_checkins c WHERE c.habit_id=h.id AND c.checkin_date=?) AS checked,
        (SELECT COUNT(*) FROM habit_checkins c WHERE c.habit_id=h.id
         AND c.checkin_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?) AS weekly_count
        FROM habits h WHERE h.user_id=? ORDER BY h.id`, [date, date, date, req.user.id]);
    const [schedule] = await pool.query(`SELECT s.id, p.name, s.plan_id,
        DATE_FORMAT(s.scheduled_date, '%Y-%m-%d') AS scheduled_date
        FROM workout_schedule s JOIN workout_plans p ON p.id=s.plan_id
        WHERE p.user_id=? ORDER BY s.scheduled_date, s.id`, [req.user.id]);
    const [coaches] = await pool.query(`SELECT c.*,
        EXISTS(SELECT 1 FROM subscriptions s WHERE s.coach_id=c.id AND s.user_id=?) AS subscribed
        FROM coaches c ORDER BY c.id`, [req.user.id]);
    res.json({ date, habits, schedule, coaches });
}));
router.post('/habits', run(async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) return res.status(400).json({ error: 'Habit name must be 1–100 characters' });
    const [result] = await pool.query('INSERT INTO habits (user_id,name) VALUES (?,?)', [req.user.id, name]);
    res.status(201).json({ id: result.insertId });
}));
router.delete('/habits/:id', run(async (req, res) => {
    const [result] = await pool.query('DELETE FROM habits WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.status(result.affectedRows ? 200 : 404).json({ message: result.affectedRows ? 'Habit deleted' : 'Habit not found' });
}));
router.put('/habits/:id/checkin', run(async (req, res) => {
    const { date, checked } = req.body;
    if (!validDate(date) || date > new Date().toISOString().slice(0, 10) || typeof checked !== 'boolean') {
        return res.status(400).json({ error: 'Provide a valid non-future date and a boolean checked value' });
    }
    const [owned] = await pool.query('SELECT id FROM habits WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!owned.length) return res.status(404).json({ error: 'Habit not found' });
    if (checked) await pool.query(`INSERT INTO habit_checkins (habit_id,checkin_date) VALUES (?,?)
        ON DUPLICATE KEY UPDATE checkin_date=VALUES(checkin_date)`, [req.params.id, date]);
    else await pool.query('DELETE FROM habit_checkins WHERE habit_id=? AND checkin_date=?', [req.params.id, date]);
    res.json({ checked });
}));
router.post('/schedule', run(async (req, res) => {
    const { plan_id, scheduled_date } = req.body;
    if (!positiveId(plan_id) || !validDate(scheduled_date)) return res.status(400).json({ error: 'Select a plan and a valid date' });
    const [result] = await pool.query(`INSERT INTO workout_schedule (plan_id,scheduled_date)
        SELECT id,? FROM workout_plans WHERE id=? AND user_id=?`, [scheduled_date, plan_id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Plan not found' });
    res.status(201).json({ id: result.insertId });
}));
router.delete('/schedule/:id', run(async (req, res) => {
    const [result] = await pool.query(`DELETE s FROM workout_schedule s JOIN workout_plans p ON p.id=s.plan_id
        WHERE s.id=? AND p.user_id=?`, [req.params.id, req.user.id]);
    res.status(result.affectedRows ? 200 : 404).json({ message: result.affectedRows ? 'Schedule removed' : 'Schedule not found' });
}));
router.put('/coaches/:id/subscription', run(async (req, res) => {
    if (!positiveId(req.params.id) || typeof req.body.subscribed !== 'boolean') return res.status(400).json({ error: 'Invalid subscription' });
    const [coaches] = await pool.query('SELECT id FROM coaches WHERE id=?', [req.params.id]);
    if (!coaches.length) return res.status(404).json({ error: 'Coach not found' });
    if (req.body.subscribed) await pool.query(`INSERT INTO subscriptions (user_id,coach_id,started_on) VALUES (?,?,UTC_DATE())
        ON DUPLICATE KEY UPDATE coach_id=VALUES(coach_id)`, [req.user.id, req.params.id]);
    else await pool.query('DELETE FROM subscriptions WHERE user_id=? AND coach_id=?', [req.user.id, req.params.id]);
    res.json({ subscribed: req.body.subscribed });
}));
module.exports = router;
