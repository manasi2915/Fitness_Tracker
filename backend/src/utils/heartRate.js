// Heart-rate anomaly rules used by the reports API.
// The wearable data is simulated, so these flags are a demonstration of rule-based
// detection on a time series, not medical advice.
//
//   high              heart rate at or above 85% of the age-estimated maximum (220 - age)
//   elevated_resting  more than 100 bpm while the activity state is "resting"
//   low               below 40 bpm in any state
const DEFAULT_AGE = 30;          // used when the member has not entered a date of birth
const HIGH_SHARE = 0.85;
const RESTING_LIMIT = 100;
const LOW_LIMIT = 40;

function ageOn(dateOfBirth, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) return null;
    const [y, m, d] = dateOfBirth.split('-').map(Number);
    let age = now.getUTCFullYear() - y;
    if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age -= 1;
    return age >= 5 && age <= 120 ? age : null;
}

function heartRateLimits(dateOfBirth, now = new Date()) {
    const known = ageOn(dateOfBirth, now);
    const age = known ?? DEFAULT_AGE;
    const max = 220 - age;
    return {
        age,
        age_known: known !== null,
        max_heart_rate: max,
        high_threshold: Math.round(max * HIGH_SHARE),
        resting_threshold: RESTING_LIMIT,
        low_threshold: LOW_LIMIT
    };
}

function classifyReading(reading, limits) {
    const hr = Number(reading.heart_rate);
    if (!Number.isFinite(hr) || hr <= 0) return null;
    if (hr < limits.low_threshold) return 'low';
    if (hr >= limits.high_threshold) return 'high';
    if (reading.activity_state === 'resting' && hr > limits.resting_threshold) return 'elevated_resting';
    return null;
}

module.exports = { heartRateLimits, classifyReading, ageOn };
