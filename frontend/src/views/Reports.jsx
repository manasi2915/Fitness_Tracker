'use client';
import { useState } from 'react';
import { Activity, CalendarCheck, Download, Dumbbell, Footprints, HeartPulse, Info } from 'lucide-react';
import api from '../api';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import MetricCard from '../components/MetricCard';
import { usePageControls } from '../context/PageControlsContext';
import { ErrorState, LoadingBlock } from '../components/States';
import { fmtDateTime, fmtDuration, fmtNumber } from '../utils/format';

const ALERT_LABEL = { high: 'High for age', elevated_resting: 'Elevated at rest', low: 'Low' };
const ALERT_STYLE = { high: 'bg-coral-50 text-coral-600', elevated_resting: 'bg-[#fdf4e3] text-[#b26f05]', low: 'bg-[#e8f1fa] text-[#2c6aa3]' };
const COLUMNS = [
    ['date', 'Date (UTC)'], ['steps', 'Steps'], ['calories', 'Calories (kcal)'], ['readings', 'Readings'],
    ['workouts', 'Workouts'], ['workout_minutes', 'Workout minutes'], ['volume_kg', 'Volume (kg)'],
    ['habit_checkins', 'Habit check-ins'], ['heart_rate_alerts', 'Heart-rate alerts']
];

function downloadCsv(report) {
    const rows = [COLUMNS.map(([, label]) => label), ...report.days.map((d) => COLUMNS.map(([key]) => d[key]))];
    rows.push(['Total', ...COLUMNS.slice(1).map(([key]) => (key === 'readings' ? report.days.reduce((s, d) => s + d.readings, 0) : report.totals[key]))]);
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `fittrack-week-${report.start}-to-${report.end}.csv` });
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
}

export default function Reports() {
    const { refreshKey } = usePageControls();
    const [today] = useState(() => new Date().toISOString().slice(0, 10));
    const [end, setEnd] = useState(today);
    const [hours, setHours] = useState(24);
    const weekly = useFetch(async () => (await api.get('/reports/weekly', { params: { end } })).data, [end, refreshKey]);
    const alerts = useFetch(async () => (await api.get('/reports/heart-rate-alerts', { params: { hours } })).data, [hours, refreshKey], { intervalMs: 30000 });
    const w = weekly.data;
    const a = alerts.data;

    return <>
        <PageHeader title="Weekly report & alerts"
            description="A seven-day summary across workouts, habits and wearable data, plus heart-rate readings outside the expected range." />
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-text-soft">
            <Info size={16} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
            <p>Wearable values are simulated. Alerts are simple rules for this project, not medical advice.</p>
        </div>

        <section className="card p-5" aria-labelledby="weekly-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 id="weekly-heading" className="card-title">Weekly report</h2>
                    <p className="card-sub">{w ? `${w.start} to ${w.end} (UTC days)` : 'Seven days ending on the chosen date'}</p>
                </div>
                <div className="flex items-end gap-2">
                    <label className="field-label mb-0">Week ending
                        <input className="input mt-1.5" type="date" value={end} max={today} required onChange={(e) => e.target.value && setEnd(e.target.value)} />
                    </label>
                    <button type="button" className="btn btn-primary" disabled={!w} onClick={() => downloadCsv(w)}>
                        <Download size={15} aria-hidden="true" /> Download CSV
                    </button>
                </div>
            </div>

            {weekly.loading ? <div className="mt-5"><LoadingBlock rows={5} /></div>
                : weekly.error ? <ErrorState message={weekly.error} onRetry={weekly.reload} compact />
                : <>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={Dumbbell} label="Workouts completed" value={w.totals.workouts}
                            support={`${fmtDuration(w.totals.workout_minutes)} · ${fmtNumber(w.totals.volume_kg)} kg lifted · ${w.totals.scheduled_workouts} scheduled`} />
                        <MetricCard icon={CalendarCheck} tone="sky" label="Habit completion" value={w.totals.habit_completion_pct ?? '–'}
                            unit={w.totals.habit_completion_pct != null ? '%' : undefined} support={`${w.totals.habit_checkins} check-ins across ${w.habits.length} habit(s)`} />
                        <MetricCard icon={Footprints} tone="amber" label="Steps" value={fmtNumber(w.totals.steps)}
                            support={`${fmtNumber(w.totals.calories)} kcal · ${w.totals.active_days}/7 active days`} />
                        <MetricCard icon={HeartPulse} tone="coral" label="Heart-rate alerts" value={w.totals.heart_rate_alerts}
                            support={`Goals: ${w.goals.completed || 0} completed, ${w.goals.active || 0} active`} />
                    </div>
                    <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <caption className="sr-only">Daily breakdown</caption>
                            <thead>
                                <tr className="border-b border-line bg-canvas/60 text-[13px] text-text-muted">
                                    {COLUMNS.map(([key, label]) => <th key={key} scope="col" className="px-3 py-3 font-medium">{label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {w.days.map((d) => <tr key={d.date} className="hover:bg-canvas/50">
                                    {COLUMNS.map(([key]) => <td key={key} className={`px-3 py-2.5 tabular-nums ${key === 'date' ? 'whitespace-nowrap font-medium' : ''}`}>
                                        {key === 'date' ? d.date : fmtNumber(d[key])}
                                    </td>)}
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                    {w.habits.length > 0 && <div className="mt-5">
                        <h3 className="text-sm font-semibold">Habits this week</h3>
                        <ul className="mt-2 flex flex-wrap gap-2">
                            {w.habits.map((h) => <li key={h.name} className="badge bg-canvas text-text-soft">{h.name}: {h.days_completed}/7</li>)}
                        </ul>
                    </div>}
                </>}
        </section>

        <section className="card mt-5 p-5" aria-labelledby="alerts-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 id="alerts-heading" className="card-title">Heart-rate anomaly alerts</h2>
                    {a && <p className="card-sub">
                        Estimated maximum {a.limits.max_heart_rate} bpm (220 − age {a.limits.age}{a.limits.age_known ? '' : ', default because no date of birth is saved'}).
                        Flagged: at least {a.limits.high_threshold} bpm, above {a.limits.resting_threshold} bpm while resting, or below {a.limits.low_threshold} bpm.
                    </p>}
                </div>
                <label className="field-label mb-0">Period
                    <select className="input mt-1.5" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                        <option value={1}>Last hour</option>
                        <option value={24}>Last 24 hours</option>
                        <option value={168}>Last 7 days</option>
                    </select>
                </label>
            </div>
            {alerts.loading ? <div className="mt-5"><LoadingBlock rows={4} /></div>
                : alerts.error ? <ErrorState message={alerts.error} onRetry={alerts.reload} compact />
                : <>
                    <p className="mt-4 text-sm" aria-live="polite">
                        <strong>{a.total_alerts}</strong> alert(s) in {fmtNumber(a.readings_checked)} readings
                        {a.total_alerts > 0 && ` — ${Object.entries(a.counts).filter(([, n]) => n).map(([t, n]) => `${n} ${ALERT_LABEL[t].toLowerCase()}`).join(', ')}`}.
                        {a.truncated && ' Only the most recent readings were checked.'}
                    </p>
                    {a.readings_checked === 0 && <p className="mt-2 flex items-center gap-2 text-sm text-text-muted"><Activity size={15} aria-hidden="true" /> No readings in this period. Start the wearable simulator to generate data.</p>}
                    {a.alerts.length > 0 && <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                            <caption className="sr-only">Most recent heart-rate alerts</caption>
                            <thead>
                                <tr className="border-b border-line bg-canvas/60 text-[13px] text-text-muted">
                                    <th scope="col" className="px-3 py-3 font-medium">Time</th>
                                    <th scope="col" className="px-3 py-3 font-medium">Heart rate</th>
                                    <th scope="col" className="px-3 py-3 font-medium">Activity</th>
                                    <th scope="col" className="px-3 py-3 font-medium">Alert</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {a.alerts.map((x) => <tr key={x.timestamp}>
                                    <td className="px-3 py-2.5">{fmtDateTime(x.timestamp)}</td>
                                    <td className="px-3 py-2.5 tabular-nums font-medium">{x.heart_rate} bpm</td>
                                    <td className="px-3 py-2.5 capitalize">{x.activity_state}</td>
                                    <td className="px-3 py-2.5"><span className={`badge ${ALERT_STYLE[x.type]}`}>{ALERT_LABEL[x.type]}</span></td>
                                </tr>)}
                            </tbody>
                        </table>
                        {a.total_alerts > a.alerts.length && <p className="mt-2 text-xs text-text-muted">Showing the {a.alerts.length} most recent alerts.</p>}
                    </div>}
                </>}
        </section>
    </>;
}
