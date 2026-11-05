import React, { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { Camera, X, Check, RefreshCw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (photoData: string) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
}) => {
  const {
    startCamera,
    stopCamera,
    capturePhoto,
    videoRef,
    error,
    stream,
  } = useCamera();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'natural' | 'clean'>('natural');

  // Prevent duplicate camera initialization
  const startedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      if (startedRef.current) return;

      startedRef.current = true;
      setCameraLoading(true);

      try {
        await startCamera();
      } finally {
        if (mounted) {
          setCameraLoading(false);
        }
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
      startedRef.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (capturing) return;

    setCapturing(true);

    try {
      const photo = capturePhoto();

      if (photo) {
        setPhotoPreview(photo);
        setSelectedFilter('natural');
        stopCamera();
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = async () => {
    setPhotoPreview(null);
    setSelectedFilter('natural');
    setCameraLoading(true);

    try {
      stopCamera();

      // Small delay to make sure old camera track is released
      await new Promise((resolve) => setTimeout(resolve, 300));

      startedRef.current = false;
      await startCamera();
      startedRef.current = true;
    } finally {
      setCameraLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!photoPreview) return;

    onCapture(photoPreview);
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'white',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Camera size={21} color="#FFFFFF" />
          </div>

          <span
            style={{
              fontWeight: 700,
              fontSize: '1.05rem',
            }}
          >
            Attendance
          </span>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={24} />
        </button>
      </div>

      {/* CAMERA ERROR */}
      {error ? (
        <div
          style={{
            color: 'white',
            textAlign: 'center',
            padding: '2rem',
            maxWidth: 360,
          }}
        >
          <Camera
            size={52}
            style={{
              marginBottom: '1rem',
              opacity: 0.7,
            }}
          />

          <h3
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1.1rem',
            }}
          >
            Camera Unavailable
          </h3>

          <p
            style={{
              color: '#D1D5DB',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={handleCancel}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#111827',
              border: 'none',
              borderRadius: 10,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            maxWidth: 600,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* CAMERA AREA */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            {!photoPreview ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#000',
                    transform: 'scaleX(-1)',
                  }}
                />

                {/* LOADING */}
                {cameraLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#000',
                      zIndex: 4,
                    }}
                  >
                    <div
                      style={{
                        color: 'white',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          border: '3px solid rgba(255,255,255,0.25)',
                          borderTopColor: '#16A34A',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 1rem',
                        }}
                      />

                      <div
                        style={{
                          fontSize: '0.9rem',
                          color: '#D1D5DB',
                        }}
                      >
                        Starting camera...
                      </div>
                    </div>
                  </div>
                )}

              </>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#111',
                }}
              >
                <img
                  src={photoPreview}
                  alt="Attendance preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {selectedFilter === 'clean' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'rgba(255, 245, 225, 0.12)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* BOTTOM CONTROLS */}
          <div
            style={{
              padding:
                '1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom))',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#000',
              gap: '2.5rem',
              minHeight: 130,
            }}
          >
            {!photoPreview ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!stream || cameraLoading || capturing}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '6px solid #16A34A',
                  cursor:
                    stream && !cameraLoading && !capturing
                      ? 'pointer'
                      : 'not-allowed',
                  opacity:
                    stream && !cameraLoading && !capturing
                      ? 1
                      : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={30} color="#16A34A" />
              </button>
            ) : (
              <>
                {/* FILTERS */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 150,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    zIndex: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('natural')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 10,
                      border:
                        selectedFilter === 'natural'
                          ? '2px solid #16A34A'
                          : '1px solid rgba(255,255,255,0.35)',
                      background:
                        selectedFilter === 'natural'
                          ? '#16A34A'
                          : 'rgba(0,0,0,0.65)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Natural
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('clean')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 10,
                      border:
                        selectedFilter === 'clean'
                          ? '2px solid #16A34A'
                          : '1px solid rgba(255,255,255,0.35)',
                      background:
                        selectedFilter === 'clean'
                          ? '#16A34A'
                          : 'rgba(0,0,0,0.65)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clean
                  </button>
                </div>

                {/* RETAKE */}
                <button
                  type="button"
                  onClick={handleRetake}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      backgroundColor:
                        'rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RefreshCw size={25} color="white" />
                  </div>

                  <span style={{ fontSize: '0.85rem' }}>
                    Retake
                  </span>
                </button>

                {/* CONFIRM */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      backgroundColor: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={32} color="white" />
                  </div>

                  <span style={{ fontSize: '0.85rem' }}>
                    Confirm
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default CameraCapture;
