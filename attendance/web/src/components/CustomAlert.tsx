import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

type AlertType = 'success' | 'error';

interface AlertState {
  message: string;
  type: AlertType;
}

export default function CustomAlertProvider() {
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [showLocalhostModal, setShowLocalhostModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if web app is running on localhost or 127.0.0.1
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    const isDismissed = sessionStorage.getItem('dismiss_localhost_notice');
    if (isLocalhost && !isDismissed) {
      setShowLocalhostModal(true);
    }
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: unknown) => {
      setAlertState({
        message: String(message ?? ''),
        type: 'success',
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const closeLocalhostModal = () => {
    sessionStorage.setItem('dismiss_localhost_notice', '1');
    setShowLocalhostModal(false);
  };

  if (!alertState && !showLocalhostModal) {
    return null;
  }

  const isError =
    alertState?.message.toLowerCase().includes('failed') ||
    alertState?.message.toLowerCase().includes('error') ||
    alertState?.message.toLowerCase().includes('unable') ||
    alertState?.message.toLowerCase().includes('invalid');

  const type = isError ? 'error' : alertState?.type || 'success';

  const closeAlert = () => {
    setAlertState(null);
  };

  return (
    <>
      {/* Localhost Detection Modal */}
      {showLocalhostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '20px',
          }}
          onClick={closeLocalhostModal}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '460px',
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '32px 28px 28px',
              boxShadow: '0 25px 70px rgba(15, 23, 42, 0.35)',
              textAlign: 'center',
              animation: 'customAlertIn 0.25s ease-out',
              border: '1px solid #FED7AA',
            }}
          >
            <button
              type="button"
              onClick={closeLocalhostModal}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                border: 'none',
                background: '#F1F5F9',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
              }}
            >
              <X size={16} />
            </button>

            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                margin: '0 auto 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FFF7ED',
                color: '#EA580C',
                border: '4px solid #FFEDD5',
              }}
            >
              <AlertTriangle size={36} color="#EA580C" strokeWidth={2.2} />
            </div>

            <div
              style={{
                display: 'inline-block',
                background: '#FFEDD5',
                color: '#9A3412',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                marginBottom: '10px',
              }}
            >
              DEVELOPMENT ENVIRONMENT
            </div>

            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '20px',
                fontWeight: 700,
                color: '#1E293B',
              }}
            >
              Running on Localhost
            </h3>

            <p
              style={{
                margin: '0 auto',
                maxWidth: '380px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#64748B',
              }}
            >
              You are currently viewing the application from a local development server (<strong>{window.location.host}</strong>). Push notifications and live production webhooks require the live production domain.
            </p>

            <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={closeLocalhostModal}
                style={{
                  minWidth: '130px',
                  height: '42px',
                  padding: '0 24px',
                  border: 'none',
                  borderRadius: '12px',
                  background: '#22C55E',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(34, 197, 94, 0.25)',
                }}
              >
                Proceed to App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Alert Popups */}
      {alertState && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            padding: '20px',
          }}
          onClick={closeAlert}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '30px 28px 26px',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
              textAlign: 'center',
              animation: 'customAlertIn 0.2s ease-out',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                margin: '0 auto 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: type === 'error' ? '#FEF2F2' : '#ECFDF3',
              }}
            >
              {type === 'error' ? (
                <XCircle size={36} color="#DC2626" strokeWidth={2} />
              ) : (
                <CheckCircle2 size={36} color="#16A34A" strokeWidth={2} />
              )}
            </div>

            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '20px',
                fontWeight: 700,
                color: '#17201B',
              }}
            >
              {type === 'error' ? 'Something went wrong' : 'Success'}
            </h3>

            <p
              style={{
                margin: '0 auto',
                maxWidth: '340px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#64706A',
              }}
            >
              {alertState.message}
            </p>

            <button
              type="button"
              onClick={closeAlert}
              style={{
                marginTop: '24px',
                minWidth: '110px',
                height: '42px',
                padding: '0 24px',
                border: 'none',
                borderRadius: '10px',
                background: type === 'error' ? '#DC2626' : '#16A34A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow:
                  type === 'error'
                    ? '0 8px 20px rgba(220, 38, 38, 0.18)'
                    : '0 8px 20px rgba(22, 163, 74, 0.18)',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes customAlertIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.97);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </>
  );
}
