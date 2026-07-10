import { Outlet, useLocation } from 'react-router-dom';
import { isProduction } from '../config/appEnv';
import { isRouteLocked } from '../config/lockedFeatures';
import SubscriptionRequired from '../components/common/SubscriptionRequired';

export default function ProductionLockedRoute() {
  const { pathname } = useLocation();

  if (isProduction && isRouteLocked(pathname)) {
    return <SubscriptionRequired />;
  }

  return <Outlet />;
}
