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

interface LoginResponse {
  success: boolean;
  user: UserProfile;
}

const STORAGE_KEY = 'brantas_auth_session';

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
  async logout(): Promise<void> {
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Gagal menghapus localStorage:', e);
      }
    }
    this.sessionState.set(null);
    this.router.navigate(['/login']);
  }

  private loadSessionFromStorage(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as UserProfile;
        if (parsed.name === 'Administrator Penjurian') {
          parsed.name = 'Administrator';
          this.saveSessionToStorage(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Gagal membaca sesi auth dari storage:', e);
    }
    return null;
  }

  private saveSessionToStorage(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Gagal menyimpan sesi auth ke storage:', e);
    }
  }
}
