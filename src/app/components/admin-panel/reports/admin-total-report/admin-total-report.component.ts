import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../../services/report.service';
import { LoadingService } from '../../../../services/loading.service';
import { PageLoaderComponent } from '../../../page-loader/page-loader.component';

@Component({
  selector: 'app-admin-total-report',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoaderComponent],
  templateUrl: './admin-total-report.component.html',
  styleUrls: ['./admin-total-report.component.css']
})
export class AdminTotalReportComponent {
  loading = false;
  data: any = null;
  error: string | null = null;
  // Simple template-driven bindings for date range
  startDate: string = '';
  endDate: string = '';
  todayYMD: string = this.toLocalYMD(new Date());
  validationErrors: { start?: string; end?: string } = {};
  formValid = true;
  selectedPreset: 'today' | 'last7' | 'month' | 'lastMonth' | 'ytd' | null = null;
  private presetLabels: Record<'today' | 'last7' | 'month' | 'lastMonth' | 'ytd', string> = {
    today: 'Today',
    last7: 'Last 7 days',
    month: 'This month',
    lastMonth: 'Last month',
    ytd: 'Year to date'
  };

  get currentPresetLabel(): string | null {
    return this.selectedPreset ? this.presetLabels[this.selectedPreset] : null;
  }

  constructor(private reports: ReportService, private loadingService: LoadingService) {}

  ngOnInit() {
    // default to current month range
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // clamp to today
    this.startDate = this.toLocalYMD(start);
    this.endDate = this.toLocalYMD(end);
    this.formValid = this.validateDates(true);
    this.load();
  }

  load() {
    this.loading = true;
    this.loadingService.show();
    this.error = null;
    const start = this.startDate || undefined;
    const end = this.endDate || undefined;
    this.reports.getAdminTotal(start, end).subscribe({
      next: (res) => { this.data = res; this.loading = false; this.loadingService.hide(); },
      error: (err) => { this.error = err?.message || 'Failed to load report'; this.loading = false; this.loadingService.hide(); }
    });
  }

  // Apply removed: auto-load on changes

  onReset() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // clamp to today
    this.startDate = this.toLocalYMD(start);
    this.endDate = this.toLocalYMD(end);
    this.formValid = this.validateDates(true);
    this.selectedPreset = null;
    this.load();
  }

  applyPreset(preset: 'today' | 'last7' | 'month' | 'lastMonth' | 'ytd') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today);
    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'last7':
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        end = new Date(today);
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        // end should not go beyond today for current month
        end = new Date(today);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'ytd':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today);
        break;
    }
    this.startDate = this.toLocalYMD(start);
    this.endDate = this.toLocalYMD(end);
    this.selectedPreset = preset;
    // dates come from preset; load directly
    if (this.validateDates(true)) this.load();
  }

  onDateChange() {
    this.formValid = this.validateDates(true);
    this.selectedPreset = null; // manual change clears preset highlight
    if (this.formValid) this.load();
  }

  private toLocalYMD(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseLocalYMD(s: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private validateDates(setErrors: boolean): boolean {
    const errs: { start?: string; end?: string } = {};
    const start = this.parseLocalYMD(this.startDate || '');
    const end = this.parseLocalYMD(this.endDate || '');
    const today = this.parseLocalYMD(this.todayYMD)!;

    if (!start) errs.start = 'Start date is required';
    if (!end) errs.end = 'End date is required';

    if (start && end && start.getTime() > end.getTime()) {
      errs.end = 'End date must be on or after start date';
    }
    if (start && start.getTime() > today.getTime()) errs.start = 'Start date cannot be in the future';
    if (end && end.getTime() > today.getTime()) errs.end = 'End date cannot be in the future';

    if (setErrors) this.validationErrors = errs;
    return Object.keys(errs).length === 0;
  }
}
