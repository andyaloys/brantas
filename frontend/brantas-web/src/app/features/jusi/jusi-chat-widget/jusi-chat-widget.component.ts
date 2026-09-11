import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { JusiChatService, EXECUTIVE_QUICK_PROMPTS } from '../services/jusi-chat.service';
import { JusiWidgetService } from '../services/jusi-widget.service';

@Component({
  selector: 'app-jusi-chat-widget',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './jusi-chat-widget.component.html',
  styleUrl: './jusi-chat-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JusiChatWidgetComponent {
  protected readonly chat = inject(JusiChatService);
  protected readonly widget = inject(JusiWidgetService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;

  protected formatChatMessage(rawText: string | null | undefined): SafeHtml {
    if (!rawText) return '';

    // 1. Bersihkan baris tabel markdown (|---|---|) dan rapikan baris data jika ada
    const cleaned = rawText
      .split('\n')
      .filter(line => !/^\s*\|?[\s\-:|]+\|?\s*$/.test(line))
      .map(line => {
        const tableMatch = line.match(/^\s*\|([^|]+)\|([^|]+)\|\s*$/);
        if (tableMatch) {
          const c1 = tableMatch[1].trim();
          const c2 = tableMatch[2].trim();
          if (c1 && c2 && c1.toLowerCase() !== 'indikator') {
            return `• ${c1}: ${c2}`;
          }
          return '';
        }
        return line;
      })
      .filter(line => line.length > 0)
      .join('\n');

    // Berikan jeda baris pemisah otomatis pada butir rekomendasi bernomor
    const separated = cleaned.replace(/([^\n])\n(\d+\.\s+)/g, '$1\n\n$2');

    // 2. Escape basic HTML entities untuk keamanan
    let escaped = separated
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 3. Ubah pola **data kunci** menjadi <strong class="key-data">data kunci</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="key-data">$1</strong>');

    // 4. Ubah *teks* menjadi <em>teks</em>
    escaped = escaped.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // 5. Ubah baris baru menjadi <br>
    escaped = escaped.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(escaped);
  }

  protected readonly question = signal('');
  protected readonly isPromptsDismissed = signal(false);
  protected readonly quickPrompts = EXECUTIVE_QUICK_PROMPTS;

  // Onboarding input form signals (pre-filled with last user profile if available)
  protected readonly profileFormName = signal('');
  protected readonly profileFormUnit = signal('');

  // Hanya muncul jika sesi baru (belum ada pesan dari user)
  protected readonly isNewSession = computed(() => {
    const msgs = this.chat.activeMessages();
    return !msgs.some((m) => m.sender === 'user');
  });

  constructor() {
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }

    // Auto scroll and focus when widget opens, messages update, or loading status changes
    effect(() => {
      const isOpen = this.widget.isOpen();
      const messagesCount = this.chat.activeMessages().length;
      const loading = this.chat.isLoading();
      if (isOpen) {
        this.scrollToBottom();
        if (messagesCount > 0 || !loading) {
          setTimeout(() => {
            this.composerTextarea?.nativeElement?.focus();
          }, 150);
        }
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.altKey) && (event.key === 'j' || event.key === 'J')) {
      event.preventDefault();
      this.widget.toggle();
    } else if (event.key === 'Escape' && this.widget.isOpen()) {
      if (this.widget.isSessionsDrawerOpen()) {
        this.widget.toggleSessionsDrawer();
      } else {
        this.widget.close();
      }
    }
  }

  protected updateQuestion(event: Event): void {
    this.question.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitOnboarding(): void {
    const name = this.profileFormName().trim();
    const unit = this.profileFormUnit().trim();
    if (!name || !unit) return;
    this.chat.setUserProfile(name, unit);
    this.scrollToBottom();
    setTimeout(() => this.composerTextarea?.nativeElement?.focus(), 120);
  }

  protected usePrompt(query: string): void {
    this.question.set(query);
    this.ask();
  }

  protected dismissPrompts(): void {
    this.isPromptsDismissed.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.ask();
    }
  }

  protected startNewSession(): void {
    this.chat.startNewSession();
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }
    this.isPromptsDismissed.set(false);
    this.widget.isSessionsDrawerOpen.set(false);
    this.question.set('');
    this.scrollToBottom();
    setTimeout(() => this.composerTextarea?.nativeElement?.focus(), 100);
  }

  protected selectSession(id: string): void {
    this.chat.selectSession(id);
    this.isPromptsDismissed.set(false);
    this.widget.isSessionsDrawerOpen.set(false);
    this.scrollToBottom();
  }

  protected deleteSession(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.chat.deleteSession(id);
    this.scrollToBottom();
  }

  protected async ask(): Promise<void> {
    const q = this.question().trim();
    if (!q || this.chat.isLoading()) return;
    this.question.set('');
    this.scrollToBottom();
    await this.chat.ask(q);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTo({
          top: this.scrollContainer.nativeElement.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop =
          this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 80);
  }
}
