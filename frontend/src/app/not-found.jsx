'use client';

// Unknown address -> back to the overview (same behaviour as the old catch-all route)
import Redirect from '../components/Redirect';

export default function NotFound() {
    return <Redirect to="/" />;
}
