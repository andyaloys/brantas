import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardDataService, DashboardSummary, PriorityRegion } from '../data/dashboard-data.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly dashboardData = inject(DashboardDataService);
  protected readonly isRunning = signal(false);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly priorityRegions = signal<PriorityRegion[]>([]);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadSummary();
  }

  protected async runPipeline(): Promise<void> {
    this.isRunning.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.dashboardData.runPipeline());
      await this.loadSummary();
    } catch {
      this.error.set('Pipeline tidak dapat dijalankan. Pastikan layanan BRANTAS aktif.');
    } finally {
      this.isRunning.set(false);
    }
  }

  private async loadSummary(): Promise<void> {
    try {
      const [summary, priorityRegions] = await Promise.all([
        firstValueFrom(this.dashboardData.getSummary()),
        firstValueFrom(this.dashboardData.getPriorityRegions())
      ]);
      this.summary.set(summary);
      this.priorityRegions.set(priorityRegions);
    } catch {
      this.summary.set(null);
      this.priorityRegions.set([]);
    }
  }
}