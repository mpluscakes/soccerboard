import { useEffect, useState } from 'react';
import { Lesson } from './modes/lesson/Lesson';
import { Sandbox } from './modes/sandbox/Sandbox';

const routeOf = (): 'sandbox' | 'lesson' => (window.location.hash.replace(/^#\/?/, '') === 'lesson' ? 'lesson' : 'sandbox');

export function App() {
  const [route, setRoute] = useState(routeOf);
  useEffect(() => {
    const onHash = (): void => setRoute(routeOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route === 'lesson' ? <Lesson /> : <Sandbox />;
}
