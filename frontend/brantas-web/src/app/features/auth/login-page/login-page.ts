import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);

  constructor() {
    // Jika sudah pernah login sebelumnya, langsung arahkan ke beranda
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/beranda']);
    }
  }

  protected toggleShowPassword(): void {
    this.showPassword.update(val => !val);
  }

  protected onSubmit(): void {
    this.errorMessage.set(null);

    if (!this.username() || !this.password()) {
      this.errorMessage.set('Silakan masukkan username dan kata sandi.');
      return;
    }

    this.isSubmitting.set(true);

    // Sedikit delay simulasi autentikasi eksekutif (300ms) untuk efek transisi halus
    setTimeout(() => {
      const result = this.authService.login(this.username(), this.password());
      this.isSubmitting.set(false);

      if (result.success) {
        this.router.navigate(['/beranda']);
      } else {
        this.errorMessage.set(result.message || 'Kredensial tidak valid.');
      }
    }, 280);
  }
}
