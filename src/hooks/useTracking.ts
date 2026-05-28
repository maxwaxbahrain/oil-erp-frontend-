import api from '../api/axios';

export function useTracking() {
  const trackPage = async (pageName: string) => {
    try {
      await api.post('/api/tracking/page-visit', { page: pageName });
    } catch {
      // Never break page load
    }
  };

  return { trackPage };
}
