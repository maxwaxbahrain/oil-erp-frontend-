import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaidLink } from 'react-plaid-link';
import {
  PLAID_LINK_MODE_KEY,
  PLAID_LINK_TOKEN_KEY,
  exchangePublicToken,
} from '../../services/bankFeedsService';

function clearPlaidSession() {
  localStorage.removeItem(PLAID_LINK_TOKEN_KEY);
  localStorage.removeItem(PLAID_LINK_MODE_KEY);
}

export default function BankFeedsOAuthReturn() {
  const navigate = useNavigate();
  const token = localStorage.getItem(PLAID_LINK_TOKEN_KEY);

  const { open, ready } = usePlaidLink({
    token,
    ...(token ? { receivedRedirectUri: window.location.href } : {}),
    onSuccess: (publicToken) => {
      const mode = localStorage.getItem(PLAID_LINK_MODE_KEY);
      const finish = async () => {
        try {
          if (mode === 'connect' && publicToken) await exchangePublicToken(publicToken);
        } finally {
          clearPlaidSession();
          navigate('/finance/banking', { replace: true });
        }
      };
      void finish();
    },
    onExit: () => {
      clearPlaidSession();
      navigate('/finance/banking', { replace: true });
    },
  });

  useEffect(() => {
    if (!token) navigate('/finance/banking', { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-redwood-text-main)', fontSize: 14 }}>
      Finishing bank connection…
    </div>
  );
}
