import { useCallback, useEffect, useRef, useState } from 'react';
import { personalAlarmService, type PersonalAlarmSettings } from '../services/personalAlarmService';
import { Bell, BellOff, Volume2, Check, Clock } from 'lucide-react';
import './PersonalAlarm.css';

/**
 * 12-Hour AM/PM Time conversion helpers
 */
export function convert24To12(time24?: string): { hour: string; minute: string; ampm: 'AM' | 'PM'; display: string } {
  if (!time24) {
    return { hour: '08', minute: '30', ampm: 'AM', display: '08:30 AM' };
  }
  const parts = time24.split(':');
  let hoursNum = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  if (isNaN(hoursNum)) hoursNum = 8;

  const ampm: 'AM' | 'PM' = hoursNum >= 12 ? 'PM' : 'AM';
  let hours12 = hoursNum % 12;
  if (hours12 === 0) hours12 = 12;

  const hourStr = String(hours12).padStart(2, '0');
  const minuteStr = String(minutes).padStart(2, '0');
  return {
    hour: hourStr,
    minute: minuteStr,
    ampm,
    display: `${hourStr}:${minuteStr} ${ampm}`,
  };
}

export function convert12To24(hourStr: string, minuteStr: string, ampm: 'AM' | 'PM'): string {
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour)) hour = 8;
  const validMinute = isNaN(minute) ? '00' : String(minute).padStart(2, '0');

  if (ampm === 'AM') {
    if (hour === 12) hour = 0;
  } else {
    // PM
    if (hour !== 12) hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${validMinute}:00`;
}

/**
 * Background watcher component that checks time and triggers alert / sound
 */
export default function PersonalAlarm() {
  const [alarmConfig, setAlarmConfig] = useState<PersonalAlarmSettings | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alarmRinging, setAlarmRinging] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTriggeredDateRef = useRef<string | null>(null);

  // Request browser Notification permission on mount if supported
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load alarm settings from backend
  const loadAlarm = useCallback(async () => {
    try {
      setLoading(true);
      const data = await personalAlarmService.getAlarm();
      setAlarmConfig(data);
      setIsEnabled(Boolean(data.is_enabled));
    } catch (err) {
      console.warn('[PersonalAlarm] Failed to fetch alarm settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlarm();
  }, [loadAlarm]);

  // Sound Management
  const stopSound = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setAlarmRinging(false);
  }, []);

  const playSound = useCallback(async () => {
    try {
      const audio = audioRef.current ?? new Audio('/shift-reminder-alarm.wav');
      audio.loop = true;
      audio.volume = 0.85;
      audioRef.current = audio;
      await audio.play();
      setAudioBlocked(false);
    } catch (err) {
      console.warn('[PersonalAlarm] Audio autoplay blocked:', err);
      setAudioBlocked(true);
    }
  }, []);

  // Minute-by-minute daily scheduler
  useEffect(() => {
    if (!isEnabled || !alarmConfig?.alarm_time) return;

    const checkAlarmTime = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMins}`;
      const targetTime = alarmConfig.alarm_time.slice(0, 5);
      const todayStr = now.toDateString();

      if (currentTime === targetTime && lastTriggeredDateRef.current !== todayStr) {
        lastTriggeredDateRef.current = todayStr;
        setAlarmRinging(true);
        void playSound();

        // Browser native notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const time12 = convert24To12(alarmConfig.alarm_time).display;
            new Notification('Personal Daily Alarm', {
              body: `Your daily alarm for ${time12} is ringing!`,
              icon: '/attendance-192.png',
              requireInteraction: true,
            });
          } catch (e) {
            console.warn('[PersonalAlarm] Native notification failed:', e);
          }
        }
      }
    };

    // Run immediate check and schedule interval
    checkAlarmTime();
    const timer = setInterval(checkAlarmTime, 10000);
    return () => clearInterval(timer);
  }, [isEnabled, alarmConfig, playSound]);

  if (loading) return null;

  const displayTime = alarmConfig?.alarm_time ? convert24To12(alarmConfig.alarm_time).display : '';

  return (
    <>
      {/* ALARM RINGING MODAL */}
      {alarmRinging && (
        <div className="personal-alarm-overlay">
          <div className="personal-alarm-ring-modal">
            <div className="personal-alarm-ring-icon-box">
              <Bell size={36} className="alarm-ring-bell" />
            </div>
            <h3>Personal Daily Alarm</h3>
            <p className="personal-alarm-ring-time">{displayTime}</p>
            <p className="personal-alarm-ring-subtitle">It's time for your daily reminder!</p>

            {audioBlocked && (
              <button
                type="button"
                className="personal-alarm-unmute-btn"
                onClick={() => void playSound()}
              >
                <Volume2 size={16} /> Tap to Enable Audio
              </button>
            )}

            <button
              type="button"
              className="personal-alarm-stop-btn"
              onClick={stopSound}
            >
              Dismiss Alarm
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Personal Daily Alarm Card component for Employee Dashboard
 * Complete 12-Hour AM/PM picker, Enable/Disable toggle, Save button & Light Green Theme
 */
export function PersonalAlarmCard() {
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('30');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [savedTimeDisplay, setSavedTimeDisplay] = useState('08:30 AM');
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await personalAlarmService.getAlarm();
        if (mounted && data) {
          if (data.alarm_time) {
            const parsed = convert24To12(data.alarm_time);
            setHour(parsed.hour);
            setMinute(parsed.minute);
            setAmpm(parsed.ampm);
            setSavedTimeDisplay(parsed.display);
          }
          setIsEnabled(Boolean(data.is_enabled));
        }
      } catch (err) {
        console.warn('Failed to load personal alarm card settings:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async (overrideEnabled?: boolean) => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      const targetEnabled = overrideEnabled !== undefined ? overrideEnabled : isEnabled;
      const formatted24 = convert12To24(hour, minute, ampm);

      const updated = await personalAlarmService.updateAlarm({
        alarm_time: formatted24,
        is_enabled: targetEnabled,
      });

      setIsEnabled(updated.is_enabled);
      const parsed = convert24To12(updated.alarm_time);
      setSavedTimeDisplay(parsed.display);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating alarm:', err);
      alert('Could not update alarm settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    void handleSave(nextState);
  };

  if (loading) return null;

  // Options for hours 01 - 12
  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  // Options for minutes 00 - 59
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="personal-alarm-card">
      <div className="personal-alarm-card-header">
        <div className="personal-alarm-icon-box">
          {isEnabled ? <Bell size={22} className="alarm-active-bell" /> : <BellOff size={22} />}
        </div>
        <div className="personal-alarm-header-info">
          <div className="personal-alarm-title-row">
            <h4>Personal Daily Alarm</h4>
            <span className={`personal-alarm-status-pill ${isEnabled ? 'active' : 'inactive'}`}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p>Recurring daily reminder at your exact preferred time.</p>
        </div>
        <button
          type="button"
          className={`personal-alarm-toggle ${isEnabled ? 'active' : ''}`}
          onClick={handleToggle}
          disabled={saving}
          aria-label="Toggle alarm"
        >
          <span className="personal-alarm-toggle-thumb" />
        </button>
      </div>

      <div className="personal-alarm-card-body">
        <div className="personal-alarm-time-control">
          <label>
            <Clock size={16} /> Alarm Time:
          </label>

          {/* 12-Hour AM/PM Selector */}
          <div className="alarm-picker-container">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              disabled={saving}
              className="alarm-time-select"
              aria-label="Hour"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="alarm-time-colon">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              disabled={saving}
              className="alarm-time-select"
              aria-label="Minute"
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="alarm-ampm-btn-group">
              <button
                type="button"
                className={`alarm-ampm-btn ${ampm === 'AM' ? 'active' : ''}`}
                onClick={() => setAmpm('AM')}
                disabled={saving}
              >
                AM
              </button>
              <button
                type="button"
                className={`alarm-ampm-btn ${ampm === 'PM' ? 'active' : ''}`}
                onClick={() => setAmpm('PM')}
                disabled={saving}
              >
                PM
              </button>
            </div>
          </div>

          <div className="personal-alarm-saved-display">
            <span>Saved:</span>
            <strong>{savedTimeDisplay}</strong>
          </div>
        </div>

        <button
          type="button"
          className="personal-alarm-save-btn"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Time'}
        </button>
      </div>

      {saveSuccess && (
        <div className="personal-alarm-success-msg">
          <Check size={14} /> Daily alarm saved for {savedTimeDisplay} ({isEnabled ? 'Active' : 'Disabled'}).
        </div>
      )}
    </div>
  );
}
