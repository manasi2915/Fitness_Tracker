import { Check, Circle } from 'lucide-react';
import { passwordRules } from '../utils/password';

export default function PasswordChecklist({ password, id }) {
    return (
        <ul id={id} className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Password requirements">
            {passwordRules(password).map((r) => (
                <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-brand-700' : 'text-text-muted'}`}>
                    {r.ok ? <Check size={13} aria-hidden="true" /> : <Circle size={11} aria-hidden="true" />}
                    {r.label}<span className="sr-only">{r.ok ? ' (met)' : ' (not met)'}</span>
                </li>
            ))}
        </ul>
    );
}
