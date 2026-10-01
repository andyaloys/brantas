import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface UserProfile {
  username: string;
  name: string;
  role: string;
  department: string;
  avatarIcon: string;
}

interface StoredSession {
  user: UserProfile;
  loginTime: number;
  expiresAt: number;     // 60 menit batas maksimal sesi login
  lastActiveAt: number;  // timestamp aktivitas interaksi terakhir pengguna
}

interface LoginResponse {
  success: boolean;
  user: UserProfile;
}

const STORAGE_KEY = 'brantas_auth_session';
const MAX_SESSION_DURATION_MS = 60 * 60 * 1000; // 60 menit (maksimal durasi sesi)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;          // 30 menit (batas inaktivitas pengguna)
const ACTIVITY_THROTTLE_MS = 10 * 1000;         // 10 detik throttle deteksi aktivitas

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  // Kredensial khusus sistem BRANTAS
  private static readonly USERS: Record<string, { pass: string; profile: UserProfile }> = {
    admin: {
      pass: 'Admin123!',
      profile: {
        username: 'admin',
        name: 'Administrator',
        role: 'DEWAN JURI / EKSEKUTIF PUSAT',
        department: 'Evaluasi & Verifikasi LAN Datathon 2026',
        avatarIcon: 'pi pi-shield'
      }
    },
    dev: {
      pass: 'Dev123!',
      profile: {
        username: 'dev',
        name: 'Pengembang Sistem',
        role: 'DEVELOPER / PENGEMBANG SISTEM',
        department: 'Tim Teknis & Pengembangan BRANTAS',
        avatarIcon: 'pi pi-code'
      }
    }
  };

  private readonly sessionState = signal<UserProfile | null>(this.loadSessionFromStorage());

  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly currentUser = computed(() => this.sessionState());

  private heartbeatTimer?: any;
  private lastThrottledUpdate = 0;
  private activityListeners: Array<{ event: string; listener: () => void }> = [];

  constructor() {
    if (this.sessionState()) {
      this.startInactivityMonitoring();
    }
  }

  /**
   * Bypass login otomatis untuk kebutuhan Demo Dewan Juri / Presentasi
   */
  loginDemo(): void {
    const demoProfile: UserProfile = AuthService.USERS['admin'].profile;
    this.saveSessionToStorage(demoProfile);
    this.sessionState.set(demoProfile);
  }

  /**
   * Coba autentikasi menggunakan username dan password
   * Mengirim request ke backend API untuk pencatatan log akses (AuditLog) di database
   */
  async login(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    const trimmedUser = username?.trim().toLowerCase();
    const trimmedPass = password?.trim();

    try {
      // Kirim request ke backend API agar tercatat ke database audit_logs
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
          username: trimmedUser,
          password: trimmedPass
        })
      );

      if (response?.success && response.user) {
        this.saveSessionToStorage(response.user);
        this.sessionState.set(response.user);
        return { success: true };
      }
    } catch (err: any) {
      // Jika respons 401 Unauthorized dari backend (kredensial salah)
      if (err?.status === 401) {
        return {
          success: false,
          message: 'Username atau kata sandi tidak sesuai.'
        };
      }

      // Jika backend tidak dapat dihubungi (offline/mock fallback), verifikasi lokal
      console.warn('Backend auth endpoint offline/tidak terjangkau, menggunakan verifikasi lokal:', err);
      const userDef = AuthService.USERS[trimmedUser];
      if (userDef && userDef.pass === trimmedPass) {
        this.saveSessionToStorage(userDef.profile);
        this.sessionState.set(userDef.profile);
        return { success: true };
      }
    }

    return {
      success: false,
      message: 'Username atau password tidak sesuai.'
    };
  }

  /**
   * Keluar dari sistem, kirim log akses ke database, hapus sesi, dan arahkan kembali ke /login
   */
  async logout(reason?: string): Promise<void> {
    const user = this.sessionState();
    if (user) {
      try {
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/auth/logout`, {
            username: user.username,
            role: user.role
          })
        );
      } catch (e) {
        console.warn('Gagal mencatat log logout ke server:', e);
      }
    }

    this.clearStorage();
    this.stopInactivityMonitoring();
    this.sessionState.set(null);

    if (reason) {
      this.router.navigate(['/login'], { queryParams: { reason } });
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Membaca sesi dari sessionStorage (otomatis terhapus saat user menutup browser/tab).
   * Memvalidasi durasi maksimal 60 menit dan inaktivitas 30 menit.
   */
  private loadSessionFromStorage(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      // Bersihkan localStorage sisa implementasi sebelumnya untuk migrasi ke sessionStorage
      localStorage.removeItem(STORAGE_KEY);

      const data = sessionStorage.getItem(STORAGE_KEY);
      if (!data) return null;

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        this.clearStorage();
        return null;
      }

      // Format legacy UserProfile polos -> konversi ke StoredSession
      if (!parsed.expiresAt || !parsed.user) {
        const now = Date.now();
        const profile = parsed as UserProfile;
        this.saveSessionToStorage(profile);
        return profile;
      }

      const session = parsed as StoredSession;
      const now = Date.now();

      // 1. Validasi batas maksimal sesi (60 menit)
      if (now > session.expiresAt) {
        console.warn('Sesi login telah mencapai batas maksimal 60 menit.');
        this.clearStorage();
        return null;
      }

      // 2. Validasi batas inaktivitas (30 menit)
      if (now - session.lastActiveAt > IDLE_TIMEOUT_MS) {
        console.warn('Sesi login kedaluwarsa karena tidak ada aktivitas.');
        this.clearStorage();
        return null;
      }

      // Update aktivitas pada saat load
      session.lastActiveAt = now;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session.user;
    } catch (e) {
      console.warn('Gagal membaca sesi auth dari sessionStorage:', e);
    }
    return null;
  }

  /**
   * Menyimpan sesi ke sessionStorage dengan cap maksimal 60 menit
   */
  private saveSessionToStorage(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const session: StoredSession = {
        user: profile,
        loginTime: now,
        expiresAt: now + MAX_SESSION_DURATION_MS,
        lastActiveAt: now
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      this.startInactivityMonitoring();
    } catch (e) {
      console.warn('Gagal menyimpan sesi auth ke sessionStorage:', e);
    }
  }

  private clearStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Gagal membersihkan storage auth:', e);
    }
  }

  /**
   * Monitor aktivitas interaksi pengguna (mousemove, keydown, click, scroll, touch)
   * dan periodik heartbeat timer setiap 15 detik.
   */
  private startInactivityMonitoring(): void {
    if (typeof window === 'undefined') return;
    this.stopInactivityMonitoring();

    const updateActivity = () => {
      const now = Date.now();
      if (now - this.lastThrottledUpdate < ACTIVITY_THROTTLE_MS) return;
      this.lastThrottledUpdate = now;

      try {
        const data = sessionStorage.getItem(STORAGE_KEY);
        if (data) {
          const session = JSON.parse(data) as StoredSession;
          if (session && session.user) {
            session.lastActiveAt = now;
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          }
        }
      } catch {}
    };

    this.activityListeners = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].map(evtName => {
      const listener = () => updateActivity();
      window.addEventListener(evtName, listener, { passive: true });
      return { event: evtName, listener };
    });

    this.heartbeatTimer = setInterval(() => {
      this.checkSessionValidity();
    }, 15000);
  }

  private stopInactivityMonitoring(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (typeof window !== 'undefined' && this.activityListeners.length > 0) {
      for (const item of this.activityListeners) {
        window.removeEventListener(item.event, item.listener);
      }
      this.activityListeners = [];
    }
  }

  /**
   * Mengecek validitas sesi aktif terhadap batas 60 menit dan inaktivitas 30 menit
   */
  checkSessionValidity(): void {
    if (typeof window === 'undefined') return;
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (!data) {
      if (this.sessionState() !== null) {
        this.sessionState.set(null);
        this.router.navigate(['/login']);
      }
      return;
    }

    try {
      const session = JSON.parse(data) as StoredSession;
      const now = Date.now();

      // 1. Batas maksimal 60 menit
      if (session.expiresAt && now > session.expiresAt) {
        this.logout('session_expired');
        return;
      }

      // 2. Batas inaktivitas 30 menit
      if (session.lastActiveAt && (now - session.lastActiveAt > IDLE_TIMEOUT_MS)) {
        this.logout('inactivity');
        return;
      }
    } catch {
      this.logout('unauthorized');
    }
  }
}
