import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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

const STORAGE_KEY = 'brantas_jusi_sessions_v1';
const DEFAULT_WELCOME_TEXT = 'Halo, saya JUSI. Saya siap membantu menelaah data kemiskinan, menghitung simulasi anggaran, dan mengevaluasi efektivitas program perlindungan sosial berdasarkan data aktif BRANTAS.';

@Component({
  selector: 'app-jusi-page',
  templateUrl: './jusi-page.html',
  styleUrl: './jusi-page.css',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JusiPageComponent implements OnInit {
  private readonly jusiData = inject(JusiDataService);
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

  protected readonly question = signal('');
  protected readonly sessions = signal<ChatSession[]>([]);
  protected readonly activeSessionId = signal<string>('');
  protected readonly isLoading = signal(false);

  protected readonly activeSession = computed(() => {
    const list = this.sessions();
    const id = this.activeSessionId();
    return list.find((s) => s.id === id) ?? list[0] ?? null;
  });

  protected readonly activeMessages = computed(() => {
    return this.activeSession()?.messages ?? [];
  });

  ngOnInit(): void {
    this.loadSessionsFromStorage();
  }

  protected updateQuestion(event: Event): void {
    this.question.set((event.target as HTMLTextAreaElement).value);
  }

  protected useQuestion(q: string): void {
    this.question.set(q);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  protected startNewSession(): void {
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
    this.question.set('');
    this.saveSessionsToStorage();
    this.scrollToBottom();
  }

  protected selectSession(id: string): void {
    this.activeSessionId.set(id);
    this.scrollToBottom();
  }

  protected deleteSession(id: string, event: MouseEvent): void {
    event.stopPropagation();
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
    this.scrollToBottom();
  }

  protected async ask(): Promise<void> {
    const q = this.question().trim();
    if (!q || this.isLoading()) return;

    let active = this.activeSession();
    if (!active) {
      this.startNewSession();
      active = this.activeSession();
    }

    const currentSessionId = active!.id;
    this.question.set('');

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
    this.scrollToBottom();

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
      this.scrollToBottom();
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
          this.scrollToBottom();
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

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 60);
  }
}
