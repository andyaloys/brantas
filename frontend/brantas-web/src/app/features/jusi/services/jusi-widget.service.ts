import { Injectable, inject, signal } from '@angular/core';
import { JusiChatService } from './jusi-chat.service';

@Injectable({
  providedIn: 'root'
})
export class JusiWidgetService {
  private readonly chatService = inject(JusiChatService);

  readonly isOpen = signal<boolean>(false);
  readonly isExpanded = signal<boolean>(false);
  readonly isSessionsDrawerOpen = signal<boolean>(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.isSessionsDrawerOpen.set(false);
  }

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (!next) {
      this.isSessionsDrawerOpen.set(false);
    }
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  toggleSessionsDrawer(): void {
    this.isSessionsDrawerOpen.update((v) => !v);
  }

  openWithQuestion(question: string): void {
    this.isOpen.set(true);
    this.isSessionsDrawerOpen.set(false);
    this.chatService.ask(question);
  }
}
