// Web Audio API Synthesizer for System Notifications & Operational Alerts
// Works reliably across all modern browsers with 0ms latency and without external MP3 asset dependencies.

import { safeStorage } from './storage';

const isAudioMuted = (): boolean => {
  try {
    return safeStorage.getItem('orca_sound_muted') === 'true';
  } catch {
    return false;
  }
};

/**
 * Distinctive Urgent Shortage Alert Sound (صوت تنبيه عاجل ومميز عند تسجيل أو وصول إشعار طرد ناقص)
 * Synthesizes an unmistakable, high-priority dual-pulse siren chime via Web Audio API AudioContext.
 */
export const playShortageAlertSound = () => {
  if (isAudioMuted()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const createPulseNote = (
      freq: number,
      startTime: number,
      duration: number,
      waveType: OscillatorType = 'sawtooth',
      peakGain: number = 0.4
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack & Sharp Decay
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // First Warning Pulse Burst (Fast 3-note ascending/descending emergency beacon)
    createPulseNote(880.0, now, 0.12, 'sawtooth', 0.45);        // A5
    createPulseNote(587.33, now + 0.08, 0.12, 'square', 0.4);   // D5
    createPulseNote(1046.5, now + 0.16, 0.22, 'triangle', 0.55); // C6

    // Second Warning Pulse Burst (Higher urgency echo)
    createPulseNote(880.0, now + 0.32, 0.12, 'sawtooth', 0.5);   // A5
    createPulseNote(587.33, now + 0.40, 0.12, 'square', 0.45);  // D5
    createPulseNote(1174.66, now + 0.48, 0.35, 'triangle', 0.6); // D6 (Long resonant alert)

    // Third Harmonic Accent
    createPulseNote(1760.0, now + 0.52, 0.25, 'sine', 0.35);     // A6
  } catch (err) {
    console.warn('Audio play error in playShortageAlertSound:', err);
  }
};

/**
 * Shortage Resolved / Parcel Found Sound (نغمة تأكيد العثور على الطرد واستعادته)
 */
export const playShortageResolvedSound = () => {
  if (isAudioMuted()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playHarmonic = (freq: number, startTime: number, duration: number, gainVal: number = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Upbeat tri-tone resolution (C5 -> E5 -> G5 -> C6)
    playHarmonic(523.25, now, 0.2, 0.3);
    playHarmonic(659.25, now + 0.1, 0.2, 0.35);
    playHarmonic(783.99, now + 0.2, 0.25, 0.4);
    playHarmonic(1046.5, now + 0.3, 0.45, 0.5);
  } catch (err) {
    console.warn('Audio play error in playShortageResolvedSound:', err);
  }
};

/**
 * Cashier Payment Alert Chime Pattern (Muted for operational field quietness)
 */
export const playCashierPaymentAlertSound = () => {
  // Silenced per Prompt 67: Muted in field operations to prevent disruption during COD collection
};

/**
 * General Notification Sound
 */
export const playGeneralNotificationSound = () => {
  if (isAudioMuted()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
};

/**
 * Truck Dock Arrival Chime (صوت وصول وتواجد الشاحنة برصيف الاستلام في فرع الوجهة)
 * Distinctive, professional 3-tone melodic chime: F5 (698Hz) -> A5 (880Hz) -> C6 (1046Hz) with smooth decay.
 */
export const playTruckDockArrivalSound = () => {
  if (isAudioMuted()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playHarmonic = (freq: number, startTime: number, duration: number, gainVal: number = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Resonant arrival fanfare (F5 -> A5 -> C6 -> F6)
    playHarmonic(698.46, now, 0.22, 0.3);        // F5
    playHarmonic(880.00, now + 0.12, 0.22, 0.35); // A5
    playHarmonic(1046.50, now + 0.24, 0.28, 0.4); // C6
    playHarmonic(1396.91, now + 0.38, 0.55, 0.45); // F6 resonant sustain
  } catch (err) {
    console.warn('Audio play error in playTruckDockArrivalSound:', err);
  }
};

/**
 * Truck Dispatched Chime (صوت انطلاق وترحيل الشاحنة بنجاح)
 */
export const playTruckDispatchedSound = () => {
  if (isAudioMuted()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number, gainVal: number = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Energetic departure tone (D5 -> G5 -> B5)
    playTone(587.33, now, 0.15, 0.3);
    playTone(783.99, now + 0.12, 0.2, 0.35);
    playTone(987.77, now + 0.25, 0.4, 0.4);
  } catch (err) {
    console.warn('Audio play error in playTruckDispatchedSound:', err);
  }
};
