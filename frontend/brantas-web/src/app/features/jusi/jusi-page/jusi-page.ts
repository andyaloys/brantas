import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

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
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 60);
  }
}
