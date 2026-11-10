// Root layout of the FitTrack Next.js app (App Router). Every page renders inside it.
import '@fontsource-variable/inter';
import './globals.css';
import Providers from './providers';

export const metadata = {
    title: { default: 'FitTrack', template: '%s · FitTrack' },
    description: 'Fitness and habit tracking with a simulated wearable (MySQL + Redis).',
    icons: { icon: '/favicon.svg' }
};

export const viewport = { themeColor: '#0b1424' };

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
