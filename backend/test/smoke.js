// Requires the running local demo. Removes only journal/photo records created here.
const assert = require('node:assert/strict');
const base = process.env.TEST_API_URL || 'http://localhost:5000/api';
let token, journal, photo, checks = 0;
async function request(method, route, body, status = 200) {
    const response = await fetch(base + route, { method, signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`); checks++;
    return data;
}
(async () => {
    assert.equal((await request('GET', '/health')).status, 'ok');
    token = (await request('POST', '/auth/demo', {})).token;
    await request('GET', '/admin/users', undefined, 403);
    await request('GET', '/dashboard');
    await request('GET', '/activity/readings?range=1h');
    await request('GET', '/activity/daily?days=7');
    const week = await request('GET', '/reports/weekly');
    assert.equal(week.days.length, 7);
    const alerts = await request('GET', '/reports/heart-rate-alerts?hours=24');
    assert.ok(alerts.readings_checked >= alerts.total_alerts);
    journal = await request('POST', '/journals', { title: 'Automated review smoke test', notes: 'Disposable test record', tags: ['test'] }, 201);
    assert.ok((await request('GET', '/journals')).some(j => j.id === journal.id));
    await request('PUT', `/journals/${journal.id}`, { notes: 'Updated test record' });
    assert.equal((await request('GET', '/journals')).find(j => j.id === journal.id).notes, 'Updated test record');
    photo = await request('POST', '/photos', { caption: 'Automated review smoke test', date: '2026-10-26' }, 201);
    await request('PUT', `/photos/${photo.id}`, { caption: 'Updated test caption' });
    assert.equal((await request('GET', '/photos')).find(p => p.id === photo.id).caption, 'Updated test caption');
    await request('DELETE', `/journals/${journal.id}`); journal = null;
    await request('DELETE', `/photos/${photo.id}`); photo = null;
    console.log(`PASS: ${checks} live API checks including both stores, demo auth, member admin denial, journal/photo CRUD and telemetry reads, weekly report and heart-rate alerts.`);
})().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; }).finally(async () => {
    if (journal) await request('DELETE', `/journals/${journal.id}`).catch(() => {});
    if (photo) await request('DELETE', `/photos/${photo.id}`).catch(() => {});
});
