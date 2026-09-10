import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { KioskModeService } from '../../core/services/kiosk-mode.service';
import { ThemeService } from '../../core/services/theme.service';
import { ExecutiveTickerComponent } from '../executive-ticker/executive-ticker.component';
import { JusiChatWidgetComponent } from '../../features/jusi/jusi-chat-widget/jusi-chat-widget.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ExecutiveTickerComponent,
    JusiChatWidgetComponent
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly router = inject(Router);
  protected readonly kiosk = inject(KioskModeService);
  protected readonly themeService = inject(ThemeService);

  // Auto-hide mode (default): sidebar slim 76px, melebar saat cursor hover.
  // Pinned mode: sidebar terkunci lebar 268px secara permanen.
  protected readonly isSidebarPinned = signal(false);
  protected readonly isSidebarHovered = signal(false);

  // Sidebar dianggap terbuka jika sedang di-pin ATAU kursor sedang berada di atas sidebar
  protected readonly isSidebarExpanded = computed(() => this.isSidebarPinned() || this.isSidebarHovered());

  protected onSidebarMouseEnter(): void {
    if (!this.isSidebarPinned()) {
      this.isSidebarHovered.set(true);
    }
  }

  protected onSidebarMouseLeave(): void {
    this.isSidebarHovered.set(false);
  }

  protected toggleSidebarPin(): void {
    this.isSidebarPinned.update(val => !val);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.kiosk.isKioskActive()) {
      if (event.code === 'Space') {
        event.preventDefault();
        this.kiosk.togglePlay();
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        this.kiosk.nextSlide();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        this.kiosk.prevSlide();
      } else if (event.code === 'Escape') {
        this.kiosk.stopKiosk();
      }
    }
  }
}