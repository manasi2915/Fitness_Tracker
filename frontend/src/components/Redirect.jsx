import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Client-side redirect for pages that decide where to go from the signed-in state
// (which is only known in the browser). Renders nothing while it moves on.
export default function Redirect({ to }) {
    const router = useRouter();
    useEffect(() => {
        router.replace(to);
    }, [router, to]);
    return null;
}
