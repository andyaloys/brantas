import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface KioskSlide {
  id: string;
  title: string;
  route: string;
  durationSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class KioskModeService {
  private readonly router = inject(Router);

  readonly isKioskActive = signal(false);
  readonly isPlaying = signal(true);
  readonly currentSlideIndex = signal(0);
  readonly remainingSeconds = signal(15);
  readonly currentDateTime = signal(new Date());

  readonly slides: KioskSlide[] = [
    { id: 'beranda-macro', title: 'Ringkasan Makro & 6 KPI Nasional', route: '/beranda?tab=macro', durationSeconds: 12 },
    { id: 'beranda-allocation', title: 'Matriks Kuadran Fiskal & Radar Prioritas', route: '/beranda?tab=allocation', durationSeconds: 12 },
    { id: 'peta', title: 'Intelijen Geospasial & Klaster Moran\'s I', route: '/peta-spasial', durationSeconds: 12 },
    { id: 'anomali', title: 'Audit Integritas Fiskal & Kepesertaan Mikro', route: '/anomali', durationSeconds: 12 },
    { id: 'dampak', title: 'Evaluasi Dampak Kebijakan (DiD & TWFE)', route: '/dampak', durationSeconds: 12 }
  ];

  private tickerTimer?: any;
  private clockTimer?: any;

  constructor() {
    this.startClock();
  }

  private startClock(): void {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.currentDateTime.set(new Date());
      }, 1000);
    }
  }

  startKiosk(): void {
    this.isKioskActive.set(true);
    this.isPlaying.set(true);
    this.currentSlideIndex.set(0);
    this.remainingSeconds.set(this.slides[0].durationSeconds);

    if (typeof document !== 'undefined') {
      document.body.classList.add('kiosk-active');
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }

    this.navigateToSlide(0);
    this.startAutoPlay();
  }

  stopKiosk(): void {
    this.isKioskActive.set(false);
    this.clearTickerTimer();

    if (typeof document !== 'undefined') {
      document.body.classList.remove('kiosk-active');
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.isPlaying.set(false);
      this.clearTickerTimer();
    } else {
      this.isPlaying.set(true);
      this.startAutoPlay();
    }
  }

  nextSlide(): void {
    const nextIdx = (this.currentSlideIndex() + 1) % this.slides.length;
    this.navigateToSlide(nextIdx);
  }

  prevSlide(): void {
    const prevIdx = (this.currentSlideIndex() - 1 + this.slides.length) % this.slides.length;
    this.navigateToSlide(prevIdx);
  }

  private navigateToSlide(index: number): void {
    this.currentSlideIndex.set(index);
    const slide = this.slides[index];
    this.remainingSeconds.set(slide.durationSeconds);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.router.navigateByUrl(slide.route);
  }

  private startAutoPlay(): void {
    this.clearTickerTimer();
    this.tickerTimer = setInterval(() => {
      if (!this.isPlaying()) return;

      const rem = this.remainingSeconds() - 1;
      this.remainingSeconds.set(rem);

      // Smooth Auto-Scroll Logic for TV/Kiosk
      if (typeof window !== 'undefined') {
        if (rem === 10) {
          // Scroll smoothly down to see mid-page charts
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScroll > 150) {
            window.scrollTo({ top: Math.min(maxScroll, 580), behavior: 'smooth' });
          }
        } else if (rem === 2) {
          // Scroll back up before transitioning
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      if (rem <= 0) {
        this.nextSlide();
      }
    }, 1000);
  }

  private clearTickerTimer(): void {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = undefined;
    }
  }
}
