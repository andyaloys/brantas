import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JusiDataService, JusiResponse } from '../data/jusi-data.service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
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
  messages: ChatMessage[];
}

export const STORAGE_KEY = 'brantas_jusi_sessions_v1';
export const DEFAULT_WELCOME_TEXT =
  'Halo, saya JUSI. Saya siap membantu menelaah data kemiskinan, menghitung simulasi anggaran, dan mengevaluasi efektivitas program perlindungan sosial berdasarkan data aktif BRANTAS.';

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

  startNewSession(): void {
    const newSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Obrolan Baru',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 'welcome-' + Date.now(),
          sender: 'assistant',
          text: DEFAULT_WELCOME_TEXT,
          timestamp: new Date().toISOString()
        }
      ]
    };

    this.sessions.update((prev) => [newSession, ...prev]);
    this.activeSessionId.set(newSession.id);
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
    if (!active) {
      this.startNewSession();
      active = this.activeSession();
    }

    const currentSessionId = active!.id;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString()
    };

    let updatedTitle = active!.title;
    if (active!.title === 'Obrolan Baru' || active!.title === 'Sesi Baru') {
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
    } catch {
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: 'Pertanyaan tidak dapat diproses. Pastikan pertanyaan berada dalam domain BRANTAS dan tidak memuat identitas pribadi (NIK/NKK).',
        timestamp: new Date().toISOString(),
        isError: true
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
          this.sessions.set(parsed);
          this.activeSessionId.set(parsed[0].id);
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
