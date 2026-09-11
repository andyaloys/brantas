import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { JusiChatService, ChatMessage, ChatSession } from '../services/jusi-chat.service';

export type { ChatMessage, ChatSession };

@Component({
  selector: 'app-jusi-page',
  templateUrl: './jusi-page.html',
  styleUrl: './jusi-page.css',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JusiPageComponent {
  protected readonly chat = inject(JusiChatService);
  private readonly sanitizer = inject(DomSanitizer);
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

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

    // 3. Ubah pola **data kunci** menjadi <strong class="key-data">$1</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="key-data">$1</strong>');

    // 4. Ubah *teks* menjadi <em>$1</em>
    escaped = escaped.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // 5. Ubah baris baru menjadi <br>
    escaped = escaped.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(escaped);
  }

  protected readonly question = signal('');
  protected readonly profileFormName = signal('');
  protected readonly profileFormUnit = signal('');

  // Expose signals for backwards compatibility with jusi-page.html template
  protected readonly sessions = this.chat.sessions;
  protected readonly activeSessionId = this.chat.activeSessionId;
  protected readonly isLoading = this.chat.isLoading;
  protected readonly activeSession = this.chat.activeSession;
  protected readonly activeMessages = this.chat.activeMessages;

  constructor() {
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }

    // Auto scroll when messages update or loading state flips
    effect(() => {
      const _ = this.activeMessages().length;
      const __ = this.isLoading();
      this.scrollToBottom();
    });
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
    this.chat.startNewSession();
    const lastProfile = this.chat.getLastUserProfile();
    if (lastProfile.name) {
      this.profileFormName.set(lastProfile.name);
      this.profileFormUnit.set(lastProfile.unit);
    }
    this.question.set('');
    this.scrollToBottom();
  }

  protected selectSession(id: string): void {
    this.chat.selectSession(id);
    this.scrollToBottom();
  }

  protected deleteSession(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.chat.deleteSession(id);
    this.scrollToBottom();
  }

  protected async ask(): Promise<void> {
    const q = this.question().trim();
    if (!q || this.isLoading()) return;

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
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 80);
  }
}
