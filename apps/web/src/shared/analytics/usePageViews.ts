import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { track } from './analytics';

/** Emits a page.view event on each route change (mounted once in the layout). */
export function usePageViews(): void {
  const location = useLocation();
  useEffect(() => {
    track('page.view', { path: location.pathname });
  }, [location.pathname]);
}
