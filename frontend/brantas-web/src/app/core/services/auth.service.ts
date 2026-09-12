import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface UserProfile {
  username: string;
  name: string;
  role: string;
  department: string;
  avatarIcon: string;
}

const STORAGE_KEY = 'brantas_auth_session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);

  // Kredensial khusus penjurian LAN Datathon 2026
  private static readonly ADMIN_USER = 'admin';
  private static readonly ADMIN_PASS = 'Admin123!';

  private readonly sessionState = signal<UserProfile | null>(this.loadSessionFromStorage());

  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly currentUser = computed(() => this.sessionState());

  /**
   * Coba autentikasi menggunakan username dan password
   */
  login(username: string, password: string): { success: boolean; message?: string } {
    const trimmedUser = username?.trim().toLowerCase();
    const trimmedPass = password?.trim();

    if (trimmedUser === AuthService.ADMIN_USER && trimmedPass === AuthService.ADMIN_PASS) {
      const profile: UserProfile = {
        username: AuthService.ADMIN_USER,
        name: 'Administrator Penjurian',
        role: 'DEWAN JURI / EKSEKUTIF PUSAT',
        department: 'Evaluasi & Verifikasi LAN Datathon 2026',
        avatarIcon: 'pi pi-shield'
      };

      this.saveSessionToStorage(profile);
      this.sessionState.set(profile);
      return { success: true };
    }

    return {
      success: false,
      message: 'Username atau password tidak sesuai. Gunakan akun penjurian yang ditentukan.'
    };
  }

  /**
   * Helper untuk mengisi kredensial demo
   */
  getDemoCredentials(): { user: string; pass: string } {
    return {
      user: AuthService.ADMIN_USER,
      pass: AuthService.ADMIN_PASS
    };
  }

  /**
   * Keluar dari sistem, hapus sesi, dan arahkan kembali ke /login
   */
  logout(): void {
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
        return JSON.parse(data) as UserProfile;
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
