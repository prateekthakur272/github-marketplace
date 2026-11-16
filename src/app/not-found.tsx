import { Routes } from '@/components/Routes';

// GitHub Pages serves 404.html for unknown paths such as /app/OpenRest; this
// page is that 404.html, and the client router renders the right screen.
export default function NotFound() {
  return <Routes />;
}
