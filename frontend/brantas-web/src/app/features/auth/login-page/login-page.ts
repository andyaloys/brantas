import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);

  constructor() {
    // Jika sudah pernah login sebelumnya dan sesi masih aktif, langsung arahkan ke beranda
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/beranda']);
    }
  }

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.infoMessage.set('Sesi login Anda telah mencapai batas maksimal 60 menit. Demi keamanan data, silakan masuk kembali.');
    } else if (reason === 'inactivity') {
      this.infoMessage.set('Sesi login Anda berakhir karena tidak ada aktivitas selama lebih dari 30 menit. Silakan masuk kembali.');
    } else if (reason === 'unauthorized') {
      this.infoMessage.set('Silakan masuk terlebih dahulu untuk mengakses sistem.');
    }
  }

  protected toggleShowPassword(): void {
    this.showPassword.update(val => !val);
  }

  protected async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.username() || !this.password()) {
      this.errorMessage.set('Silakan masukkan username dan kata sandi.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const result = await this.authService.login(this.username(), this.password());
      this.isSubmitting.set(false);

      if (result.success) {
        this.router.navigate(['/beranda']);
      } else {
        this.errorMessage.set(result.message || 'Kredensial tidak valid.');
      }
    } catch {
      this.isSubmitting.set(false);
      this.errorMessage.set('Terjadi kesalahan saat memverifikasi kredensial.');
    }
  }
}
