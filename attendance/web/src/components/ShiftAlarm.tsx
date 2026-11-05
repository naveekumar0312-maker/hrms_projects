import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface EmployeeShift {
  name?: string;
  start_time?: string;
  end_time?: string;
}

interface EmployeeProfile {
  shift?: EmployeeShift | null;
}

export default function ShiftAlarm() {
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [title, setTitle] = useState('Shift Starting Soon');
  const [message, setMessage] = useState('Your shift starts in 5 minutes.');
  const [soundBlocked, setSoundBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  const stopSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const startSound = useCallback(async () => {
    try {
      const audio = audioRef.current ?? new Audio('/shift-reminder-alarm.wav');
      audio.loop = true;
      audio.volume = 0.8;
      audioRef.current = audio;
      await audio.play();
      setSoundBlocked(false);
    } catch (error) {
      console.warn('[ShiftAlarm] Audio playback blocked:', error);
      setSoundBlocked(true);
    }
  }, []);

const triggerAlarm = useCallback((event: 'SHIFT_START' | 'SHIFT_END') => {
    const isEnd = event === 'SHIFT_END';

    setTitle(isEnd ? 'Shift Ended' : 'Shift Starting Soon');
    setMessage(
      isEnd
        ? 'Your shift has ended.'
        : 'Your shift starts in 5 minutes.'
    );

    setAlarmOpen(true);
    void startSound();
  }, [startSound]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const checkShift = async () => {
      try {
        const response = await api.get('/employees/me/');
        if (cancelled) return;

        const profile = response.data as EmployeeProfile;
        const shift = profile?.shift;

        if (!shift?.start_time || !shift?.end_time) {
          console.warn('[ShiftAlarm] No assigned shift times in employee profile.');
          return;
        }

        const now = new Date();
        const today = now.toLocaleDateString('en-CA');
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const parseTime = (value: string) => {
          const match = value.match(/^(\d{1,2}):(\d{2})/);
          if (!match) return null;
          return Number(match[1]) * 60 + Number(match[2]);
        };

        const startMinutes = parseTime(shift.start_time);
        const endMinutes = parseTime(shift.end_time);

        if (startMinutes === null || endMinutes === null) {
          console.warn('[ShiftAlarm] Invalid shift time:', shift);
          return;
        }

        const startKey = `${today}:SHIFT_START:${shift.start_time}`;
        const endKey = `${today}:SHIFT_END:${shift.end_time}`;

        if (
          currentMinutes >= startMinutes - 5 &&
          currentMinutes < startMinutes &&
          !firedRef.current.has(startKey)
        ) {
          firedRef.current.add(startKey);
          triggerAlarm('SHIFT_START');
        }

        const isEndTimeReached =
          endMinutes > startMinutes
            ? currentMinutes >= endMinutes && currentMinutes < endMinutes + 2
            : currentMinutes >= endMinutes &&
              currentMinutes < endMinutes + 2 &&
              currentMinutes < startMinutes;

        if (isEndTimeReached && !firedRef.current.has(endKey)) {
          firedRef.current.add(endKey);
          triggerAlarm('SHIFT_END');
        }

        console.log('[ShiftAlarm] Scheduler active:', {
          shift: shift.name,
          start: shift.start_time,
          end: shift.end_time,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('[ShiftAlarm] Shift schedule fetch failed:', error);
        }
      }
    };

    void checkShift();
    intervalId = window.setInterval(() => void checkShift(), 15000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      stopSound();
    };
  }, [triggerAlarm, stopSound]);

  useEffect(() => {
    if (!alarmOpen) stopSound();
  }, [alarmOpen, stopSound]);

  if (!alarmOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="shift-alarm-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.65)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 28,
          borderRadius: 18,
          background: '#fff',
          color: '#172033',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          borderTop: '5px solid #e56108',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 16px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: '#fff0e5',
            color: '#e56108',
            fontSize: 32,
          }}
        >
          !
        </div>

        <h2 id="shift-alarm-title" style={{ margin: '0 0 12px', fontSize: 24 }}>
          {title}
        </h2>
        <p style={{ lineHeight: 1.6, color: '#475569' }}>{message}</p>
        <p style={{ fontSize: 13, color: '#64748b' }}>
          Please get ready for your shift.
        </p>

        {soundBlocked && (
          <button
            type="button"
            onClick={() => void startSound()}
            style={{
              width: '100%',
              marginBottom: 10,
              padding: 12,
              border: 0,
              borderRadius: 9,
              background: '#fff0e5',
              color: '#b94700',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Start Alarm Sound
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            stopSound();
            setAlarmOpen(false);
          }}
          style={{
            width: '100%',
            padding: 13,
            border: 0,
            borderRadius: 9,
            background: '#e56108',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Stop Alarm
        </button>
      </div>
    </div>
  );
}








