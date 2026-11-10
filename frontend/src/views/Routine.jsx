'use client';
import { useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '../api';
import useFetch from '../hooks/useFetch';
import PageHeader from '../components/PageHeader';
import { usePageControls } from '../context/PageControlsContext';
import { ErrorState, LoadingBlock } from '../components/States';

export default function Routine() {
    const { refreshKey } = usePageControls();
    const [today] = useState(() => new Date().toISOString().slice(0, 10));
    const [date, setDate] = useState(today);
    const [name, setName] = useState('');
    const [plan, setPlan] = useState('');
    const [scheduledDate, setScheduledDate] = useState(today);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const data = useFetch(async () => {
        const [routine, plans] = await Promise.all([api.get('/routine', { params: { date } }), api.get('/workouts/plans')]);
        return { ...routine.data, plans: plans.data };
    }, [date, refreshKey]);
    async function save(action, after) {
        setBusy(true); setError('');
        try { await action(); after?.(); await data.reload(); }
        catch (err) { setError(errorMessage(err)); }
        finally { setBusy(false); }
    }
    return <>
        <PageHeader title="Habits & schedule" description="Build consistency, plan your next workout, and choose coaching support." />
        {error && <p role="alert" className="card p-4 text-coral-600">{error}</p>}
        {data.loading ? <LoadingBlock rows={5} /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : <div className="grid gap-5 xl:grid-cols-2">
            <section className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold">Daily habits</h2>
                <label className="field-label">Check-in date (UTC)
                    <input className="input mt-2" type="date" value={date} max={today} required onChange={e => e.target.value && setDate(e.target.value)} />
                </label>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); save(() => api.post('/routine/habits', { name }), () => setName('')); }}>
                    <input aria-label="New habit name" className="input" placeholder="e.g. Stretch for ten minutes" maxLength={100} required value={name} onChange={e => setName(e.target.value)} />
                    <button className="btn btn-primary" disabled={busy}>Add</button>
                </form>
                {!data.data.habits.length && <p className="text-text-muted">Add your first daily habit above.</p>}
                {data.data.habits.map(h => <div key={h.id} className="flex items-center gap-3 border-t border-line pt-3">
                    <input type="checkbox" aria-label={`Completed ${h.name}`} checked={Boolean(h.checked)} disabled={busy} onChange={e => save(() => api.put(`/routine/habits/${h.id}/checkin`, { date, checked: e.target.checked }))} />
                    <div className="flex-1"><p>{h.name}</p><p className="text-xs text-text-muted">{h.weekly_count}/7 days completed through {date}</p></div>
                    <button className="btn" disabled={busy} onClick={() => { if (window.confirm('Delete this habit and its check-in history?')) save(() => api.delete(`/routine/habits/${h.id}`)); }}>Delete</button>
                </div>)}
            </section>
            <section className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold">Workout schedule</h2>
                <form className="space-y-3" onSubmit={e => { e.preventDefault(); save(() => api.post('/routine/schedule', { plan_id: Number(plan), scheduled_date: scheduledDate })); }}>
                    <label className="field-label">Workout plan<select className="input mt-2" required value={plan} onChange={e => setPlan(e.target.value)}><option value="">Choose a plan</option>{data.data.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                    <label className="field-label">Date<input className="input mt-2" type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></label>
                    <button className="btn btn-primary" disabled={busy || !data.data.plans.length}>Schedule workout</button>
                </form>
                {!data.data.plans.length && <Link className="text-brand-700 underline" href="/plans">Create a workout plan first</Link>}
                {!data.data.schedule.length && <p className="text-text-muted">No scheduled workouts yet.</p>}
                {data.data.schedule.map(s => <div key={s.id} className="flex items-center justify-between gap-3 border-t border-line pt-3"><div><p>{s.name}</p><p className="text-sm text-text-muted">{s.scheduled_date}</p></div><button className="btn" disabled={busy} onClick={() => save(() => api.delete(`/routine/schedule/${s.id}`))}>Remove</button></div>)}
                <p className="text-xs text-text-muted">Start your scheduled workout from Workout Plans. Scheduling does not log a completed session.</p>
            </section>
            <section className="card p-5 space-y-4 xl:col-span-2">
                <h2 className="text-lg font-semibold">Coaching subscriptions</h2>
                <p className="text-sm text-text-muted">Fictional coaches for this project demo. Enrolment records only; no payments or messages are sent.</p>
                {data.data.coaches.map(c => <div key={c.id} className="flex items-center justify-between gap-3 border-t border-line pt-3"><div><p className="font-medium">{c.name}</p><p className="text-sm text-text-muted">{c.specialty}</p></div><button className="btn" disabled={busy} onClick={() => save(() => api.put(`/routine/coaches/${c.id}/subscription`, { subscribed: !c.subscribed }))}>{c.subscribed ? 'Unsubscribe' : 'Subscribe'}</button></div>)}
            </section>
        </div>}
    </>;
}
