import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

type AlertType = 'success' | 'error';

interface AlertState {
  message: string;
  type: AlertType;
}

export default function CustomAlertProvider() {
  const [alertState, setAlertState] = useState<AlertState | null>(null);

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

  if (!alertState) {
    return null;
  }

  const isError =
    alertState.message.toLowerCase().includes('failed') ||
    alertState.message.toLowerCase().includes('error') ||
    alertState.message.toLowerCase().includes('unable') ||
    alertState.message.toLowerCase().includes('invalid');

  const type = isError ? 'error' : alertState.type;

  const closeAlert = () => {
    setAlertState(null);
  };

  return (
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
    </div>
  );
}

