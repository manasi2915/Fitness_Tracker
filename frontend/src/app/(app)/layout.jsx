// Shared layout for every signed-in page: the "(app)" folder groups routes without adding to the URL.
// AppShell draws the sidebar and header and sends signed-out visitors to /login.
import AppShell from '../../components/AppShell';

export default function SignedInLayout({ children }) {
    return <AppShell>{children}</AppShell>;
}
