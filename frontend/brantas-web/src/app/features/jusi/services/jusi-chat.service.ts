import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JusiDataService, JusiResponse } from '../data/jusi-data.service';
import { AuthService } from '../../../core/services/auth.service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  senderName?: string;
  text: string;
  timestamp: string;
  source?: string;
  period?: string;
  usedFallback?: boolean;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userUnit?: string;
  messages: ChatMessage[];
}

export interface UserProfile {
  name: string;
  unit: string;
}

export const STORAGE_KEY = 'brantas_jusi_sessions_v1';
export const PROFILE_STORAGE_KEY = 'brantas_jusi_last_profile_v1';

export interface QuickPrompt {
  label: string;
  query: string;
  icon: string;
}

export const EXECUTIVE_QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: 'Rata-rata Kemiskinan Nasional',
    query: 'Berapa rata-rata kemiskinan nasional?',
    icon: 'pi-chart-line'
  },
  {
    label: 'Ringkasan Nilai Anomali Berisiko',
    query: 'Berapa nilai anomali fiskal yang berisiko?',
    icon: 'pi-exclamation-triangle'
  },
  {
    label: 'Evaluasi Kausalitas Dampak (DiD)',
    query: 'Bagaimana hasil evaluasi dampak kebijakan bansos (DiD)?',
    icon: 'pi-bolt'
  },
  {
    label: 'Total Pagu Belanja Perlinsos',
    query: 'Berapa total alokasi anggaran bansos?',
    icon: 'pi-wallet'
  }
];

@Injectable({
  providedIn: 'root'
})
export class JusiChatService {
  private readonly jusiData = inject(JusiDataService);
  private readonly auth = inject(AuthService);

  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSessionId = signal<string>('');
  readonly isLoading = signal(false);

  readonly activeSession = computed(() => {
    const list = this.sessions();
    const id = this.activeSessionId();
    return list.find((s) => s.id === id) ?? list[0] ?? null;
  });

  readonly activeMessages = computed(() => {
    return this.activeSession()?.messages ?? [];
  });

  constructor() {
    this.loadSessionsFromStorage();
  }

  getLastUserProfile(): UserProfile {
    const current = this.auth.currentUser();
    if (current?.name) {
      return {
        name: current.name,
        unit: current.department || current.role || 'Pusat'
      };
    }
    return { name: 'Administrator', unit: 'Pusat' };
  }

  startNewSession(): void {
    const currentAuthUser = this.auth.currentUser();
    const userName = currentAuthUser?.name?.trim() || 'Administrator';
    const userUnit = currentAuthUser?.department?.trim() || currentAuthUser?.role || 'Pusat';

    // Pesan sapaan ringkas resmi dari JUSI dengan hanya mengambil nama pengguna
    const welcomeMsg: ChatMessage = {
      id: 'welcome-' + Date.now(),
      sender: 'assistant',
      text: `Halo Bapak/Ibu ${userName}! Saya JUSI (Juru Bantuan Sosial Interaktif), siap membantu analisis data kemiskinan, simulasi alokasi APBN, dan evaluasi efektivitas bansos BRANTAS. Ada data atau topik kebijakan yang ingin Anda diskusikan?`,
      timestamp: new Date().toISOString()
    };

    const newSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Obrolan Baru',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userName,
      userUnit,
      messages: [welcomeMsg]
    };

    this.sessions.update((prev) => [newSession, ...prev]);
    this.activeSessionId.set(newSession.id);
    this.saveSessionsToStorage();
  }

  setUserProfile(name: string, unit: string): void {
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();
    if (!trimmedName) return;

    const active = this.activeSession();
    if (!active) return;
    const currentSessionId = active.id;

    this.sessions.update((list) =>
      list.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              userName: trimmedName,
              userUnit: trimmedUnit,
              updatedAt: new Date().toISOString()
            }
          : s
      )
    );

    this.saveSessionsToStorage();
  }

  selectSession(id: string): void {
    this.activeSessionId.set(id);
  }

  deleteSession(id: string): void {
    const currentList = this.sessions();
    const filtered = currentList.filter((s) => s.id !== id);

    if (filtered.length === 0) {
      this.sessions.set([]);
      this.startNewSession();
      return;
    }

    this.sessions.set(filtered);
    if (this.activeSessionId() === id) {
      this.activeSessionId.set(filtered[0].id);
    }
    this.saveSessionsToStorage();
  }

  async ask(questionText: string): Promise<void> {
    const q = questionText.trim();
    if (!q || this.isLoading()) return;

    let active = this.activeSession();
    if (!active) return;
    const currentUserName = active.userName || this.auth.currentUser()?.name || 'Administrator';

    const currentSessionId = active.id;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      senderName: currentUserName,
      text: q,
      timestamp: new Date().toISOString()
    };

    let updatedTitle = active.title;
    if (active.title === 'Sesi Baru' || active.title === 'Obrolan Baru' || active.title.startsWith('Konsultasi ')) {
      updatedTitle = q.length > 32 ? q.slice(0, 30) + '...' : q;
    }

    this.sessions.update((list) =>
      list.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              title: updatedTitle,
              updatedAt: new Date().toISOString(),
              messages: [...s.messages, userMsg]
            }
          : s
      )
    );

    this.isLoading.set(true);
    this.saveSessionsToStorage();

    try {
      const res: JusiResponse = await firstValueFrom(this.jusiData.ask(q));
      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date().toISOString(),
        source: res.source,
        period: res.period,
        usedFallback: res.usedFallback
      };

      this.sessions.update((list) =>
        list.map((s) =>
          s.id === currentSessionId
            ? {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [...s.messages, aiMsg]
              }
            : s
        )
      );
    } catch (err: any) {
      const refusalMsg = 'Mohon maaf, saya tidak bisa membantu untuk hal itu. Saya ditugaskan khusus sebagai Juru Bantuan Sosial Interaktif dengan ruang lingkup analisis data kemiskinan, alokasi anggaran APBN/TKDD, dan rekomendasi kebijakan pada sistem BRANTAS. Terima kasih.';
      const detail = err?.error?.detail || err?.message || '';
      const isRefusal = typeof detail === 'string' && (detail.includes('Mohon maaf') || detail.includes('Juru Bantuan') || detail.includes('cakupan') || detail.includes('identitas'));

      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: isRefusal ? refusalMsg : (detail || refusalMsg),
        timestamp: new Date().toISOString(),
        isError: !isRefusal
      };

      this.sessions.update((list) =>
        list.map((s) =>
          s.id === currentSessionId
            ? {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [...s.messages, errorMsg]
              }
            : s
        )
      );
    } finally {
      this.isLoading.set(false);
      this.saveSessionsToStorage();
    }
  }

  private loadSessionsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const currentAuthUser = this.auth.currentUser();
          const fallbackName = currentAuthUser?.name?.trim() || 'Administrator';
          const fallbackUnit = currentAuthUser?.department?.trim() || currentAuthUser?.role || 'Pusat';

          const normalized: ChatSession[] = parsed.map((s) => {
            const userName = s.userName || fallbackName;
            const userUnit = s.userUnit || fallbackUnit;
            let messages = s.messages || [];
            if (messages.length === 0) {
              messages = [
                {
                  id: 'welcome-' + Date.now(),
                  sender: 'assistant',
                  text: `Halo Bapak/Ibu ${userName}! Saya JUSI (Juru Bantuan Sosial Interaktif), siap membantu analisis data kemiskinan, simulasi alokasi APBN, dan evaluasi efektivitas bansos BRANTAS. Ada data atau topik kebijakan yang ingin Anda diskusikan?`,
                  timestamp: s.createdAt || new Date().toISOString()
                }
              ];
            }
            return {
              ...s,
              userName,
              userUnit,
              messages
            };
          });

          this.sessions.set(normalized);
          this.activeSessionId.set(normalized[0].id);
          this.saveSessionsToStorage();
          return;
        }
      }
    } catch {
      // fallback
    }

    this.startNewSession();
  }

  private saveSessionsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions()));
    } catch {
      // storage disabled
    }
  }
}
