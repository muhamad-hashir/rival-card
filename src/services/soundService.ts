// src/services/soundService.ts - Audio Sound Effects Service for Rival Card
import { Platform } from 'react-native';

// Safely require expo-av inside a try/catch block so Audio fails gracefully
// when running inside Expo Go (where native modules like ExponentAV aren't compiled into the client bundle).
let ExpoAudio: typeof import('expo-av').Audio | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAv = require('expo-av');
  if (expoAv && expoAv.Audio) {
    ExpoAudio = expoAv.Audio;
  }
} catch {
  ExpoAudio = null;
}

type SoundType = 'cardSnap' | 'cardDraw' | 'penalty' | 'rivalCallout' | 'winChime' | 'error';

class SoundService {
  private isMuted: boolean = false;
  private soundCache: Map<SoundType, string> = new Map();
  private audioModeConfigured: boolean = false;

  constructor() {
    this.pregenerateSounds();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  private async ensureAudioMode(): Promise<void> {
    if (this.audioModeConfigured) return;
    try {
      if (Platform.OS !== 'web' && ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
      this.audioModeConfigured = true;
    } catch {
      // Ignore if not supported in environment
    }
  }

  /**
   * Generates procedural PCM audio data URIs for all sounds.
   */
  private pregenerateSounds(): void {
    this.soundCache.set('cardSnap', this.generateCardSnapDataUri());
    this.soundCache.set('cardDraw', this.generateCardDrawDataUri());
    this.soundCache.set('penalty', this.generatePenaltyDataUri());
    this.soundCache.set('rivalCallout', this.generateRivalCalloutDataUri());
    this.soundCache.set('winChime', this.generateWinChimeDataUri());
    this.soundCache.set('error', this.generateErrorDataUri());
  }

  public async play(type: SoundType): Promise<void> {
    if (this.isMuted) return;

    // Web Audio Fallback for instantaneous playback on web
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).AudioContext) {
      try {
        this.playWebAudio(type);
        return;
      } catch {
        // Fall back to expo-av or silent
      }
    }

    // If ExpoAudio native module is not available (e.g. Expo Go without ExponentAV), gracefully return
    if (!ExpoAudio || !ExpoAudio.Sound) {
      return;
    }

    try {
      await this.ensureAudioMode();
      const uri = this.soundCache.get(type);
      if (!uri) return;

      const { sound } = await ExpoAudio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 0.85 }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // Gracefully ignore audio errors (e.g. on headless simulator/Expo Go environments)
    }
  }

  public async playCardSnap(): Promise<void> {
    await this.play('cardSnap');
  }

  public async playCardDraw(): Promise<void> {
    await this.play('cardDraw');
  }

  public async playPenalty(): Promise<void> {
    await this.play('penalty');
  }

  public async playRivalCallout(): Promise<void> {
    await this.play('rivalCallout');
  }

  public async playWinChime(): Promise<void> {
    await this.play('winChime');
  }

  public async playError(): Promise<void> {
    await this.play('error');
  }

  // ==========================================================================
  // PROCEDURAL AUDIO SYNTHESIS HELPERS
  // ==========================================================================

  private playWebAudio(type: SoundType): void {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    switch (type) {
      case 'cardSnap': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
        break;
      }
      case 'cardDraw': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(380, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        break;
      }
      case 'penalty': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        break;
      }
      case 'rivalCallout': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.08); // C6
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.25);
        osc2.stop(ctx.currentTime + 0.25);
        break;
      }
      case 'winChime': {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = ctx.currentTime + idx * 0.1;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.35, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.35);
        });
        break;
      }
      case 'error': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(120, ctx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
      }
    }
  }

  private generateCardSnapDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.07;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 450 - t * 3000;
      const decay = Math.exp(-t * 45);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.6;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private generateCardDrawDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.09;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 220 + t * 1500;
      const envelope = Math.sin((Math.PI * t) / duration);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private generatePenaltyDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.22;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 200 - t * 450;
      const decay = 1 - t / duration;
      const tone = Math.sin(2 * Math.PI * Math.max(60, freq) * t);
      samples[i] = (tone > 0 ? 0.35 : -0.35) * decay;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private generateRivalCalloutDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.25;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t < 0.1 ? 523 : 784;
      const decay = Math.exp(-((t % 0.1) * 12));
      samples[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.5;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private generateWinChimeDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.45;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let freq = 523.25;
      if (t > 0.1) freq = 659.25;
      if (t > 0.2) freq = 783.99;
      if (t > 0.3) freq = 1046.5;
      const decay = Math.exp(-((t % 0.1) * 8));
      samples[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.45;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private generateErrorDataUri(): string {
    const sampleRate = 22050;
    const duration = 0.14;
    const numSamples = Math.floor(sampleRate * duration);
    const samples: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 140;
      const wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.3 : -0.3;
      const decay = 1 - t / duration;
      samples[i] = wave * decay;
    }
    return this.createWavDataUri(samples, sampleRate);
  }

  private createWavDataUri(samples: number[], sampleRate: number): string {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // Linear quantization
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // 16-bit
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    const base64 =
      typeof btoa !== 'undefined'
        ? btoa(binary)
        : (global as any).Buffer
        ? (global as any).Buffer.from(binary, 'binary').toString('base64')
        : '';

    return `data:audio/wav;base64,${base64}`;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const soundService = new SoundService();
