import { useState, useRef, useCallback } from 'react';

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);

  const startCamera = useCallback(async () => {
    // Prevent duplicate camera requests
    if (startingRef.current || streamRef.current) {
      return;
    }

    try {
      startingRef.current = true;
      setError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not supported on this device/browser.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const video = videoRef.current;

      if (video) {
        video.srcObject = mediaStream;
        video.muted = true;
        video.playsInline = true;

        await video.play().catch((err) => {
          console.warn('Video play failed:', err);
        });
      }
    } catch (err: any) {
      console.error('Camera error:', err);

      if (err?.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else if (err?.name === 'NotReadableError') {
        setError(
          'Camera is currently being used by another application or browser tab.'
        );
      } else if (err?.name === 'NotFoundError') {
        setError('No camera was found on this device.');
      } else if (err?.name === 'OverconstrainedError') {
        setError('The requested camera is not available.');
      } else {
        setError('Unable to access the camera.');
      }
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const currentStream = streamRef.current;

    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setStream(null);
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const currentStream = streamRef.current;

    if (!video || !currentStream) {
      console.error('Camera stream unavailable');
      return null;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Camera video is not ready');
      setError('Camera is still loading. Please try again.');
      return null;
    }

    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      setError('Unable to capture photo.');
      return null;
    }

    context.save();

    context.translate(canvas.width, 0);
    context.scale(-1, 1);

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.restore();

    const photo = canvas.toDataURL('image/jpeg', 0.85);

    if (!photo || photo.length < 100) {
      setError('Invalid photo captured.');
      return null;
    }

    return photo;
  }, []);

  return {
    startCamera,
    stopCamera,
    capturePhoto,
    videoRef,
    error,
    stream,
  };
};
