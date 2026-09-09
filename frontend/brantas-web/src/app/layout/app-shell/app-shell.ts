import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
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
  protected readonly isSidebarCollapsed = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects || event.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly isDashboard = computed(() => {
    const url = this.currentUrl() || '';
    return url === '/' || url.startsWith('/beranda');
  });

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update(val => !val);
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