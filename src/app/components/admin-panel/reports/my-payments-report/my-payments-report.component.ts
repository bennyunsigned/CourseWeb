import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../../services/report.service';
import { PageLoaderComponent } from '../../../page-loader/page-loader.component';
import { LoadingService } from '../../../../services/loading.service';

@Component({
  selector: 'app-my-payments-report',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoaderComponent],
  templateUrl: './my-payments-report.component.html',
  styleUrls: ['./my-payments-report.component.css']
})
export class MyPaymentsReportComponent {
  loading = false;
  payments: any[] = [];
  error: string | null = null;
  // Filters
  startDate: string = '';
  endDate: string = '';
  today: string = new Date().toISOString().slice(0, 10);
  validationErrors: { start?: string; end?: string } = {};
  // Type/Status filters
  typeFilter: string = '';
  statusFilter: string = '';
  paymentTypes: string[] = [];
  paymentStatuses: string[] = [];
  private typeMap = new Map<string, string>(); // normalized -> pretty
  private statusMap = new Map<string, string>();

  // Pagination
  page = 1;
  pageSize = 10;
  get total(): number { return this.filteredPayments.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageStart(): number { return (this.page - 1) * this.pageSize; }
  get pageEnd(): number { return Math.min(this.pageStart + this.pageSize, this.total); }

  get pagedPayments(): any[] {
    return this.filteredPayments.slice(this.pageStart, this.pageEnd);
  }

  private filteredPayments: any[] = [];

  constructor(private reports: ReportService, private loadingService: LoadingService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.loadingService.show();
    this.reports.getMyPayments().subscribe({
      next: (res) => {
        this.payments = Array.isArray(res) ? res : (res?.items || []);
        this.computeTypeStatusOptions();
        this.applyFilters();
        this.loading = false;
        this.loadingService.hide();
      },
      error: (err) => { this.error = err?.message || 'Failed to load payments'; this.loading = false; this.loadingService.hide(); }
    });
  }

  // Apply removed: we auto-filter on date changes

  onReset() {
    this.startDate = '';
    this.endDate = '';
    this.isValid(true);
    this.applyFilters();
  }

  isValid(setErrors = false): boolean {
    const errs: { start?: string; end?: string } = {};
    const start = this.parseLocalYMD(this.startDate);
    const end = this.parseLocalYMD(this.endDate);
    const today = this.parseLocalYMD(this.today)!;
    if (start && end && start.getTime() > end.getTime()) {
      errs.end = 'End date must be on or after start date';
    }
    if (start && start.getTime() > today.getTime()) errs.start = 'Start date cannot be in the future';
    if (end && end.getTime() > today.getTime()) errs.end = 'End date cannot be in the future';
    if (setErrors) this.validationErrors = errs;
    return Object.keys(errs).length === 0;
  }

  onDateChange() {
    const ok = this.isValid(true);
    if (ok) this.applyFilters();
  }

  onTypeStatusChange() {
    // Convert pretty label to normalized key for filtering
    if (this.typeFilter) {
      const key = this.typeMap.get(this.typeFilter);
      this.typeFilter = key || this.normalize(this.typeFilter);
    }
    if (this.statusFilter) {
      const key = this.statusMap.get(this.statusFilter);
      this.statusFilter = key || this.normalize(this.statusFilter);
    }
    this.applyFilters();
  }

  applyFilters() {
    const start = this.parseLocalYMD(this.startDate);
    const end = this.parseLocalYMD(this.endDate);
    const typeSel = this.normalize(this.typeFilter);
    const statusSel = this.normalize(this.statusFilter);
    this.filteredPayments = (this.payments || []).filter(p => {
      const created = p.created_at ? new Date(p.created_at) : null;
      if (!created) return false;
      // type/status filters
      const pType = this.normalize(p.payment_type);
      const pStatus = this.normalize(p.status);
      if (typeSel && pType !== typeSel) return false;
      if (statusSel && pStatus !== statusSel) return false;
      if (start) {
        const startOfDay = new Date(start);
        startOfDay.setHours(0,0,0,0);
        if (created < startOfDay) return false;
      }
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23,59,59,999);
        if (created > endOfDay) return false;
      }
      return true;
    });
    // reset page if out of bounds
    this.page = 1;
  }

  changePage(delta: number) {
    this.page = Math.min(this.totalPages, Math.max(1, this.page + delta));
  }

  private parseLocalYMD(s?: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private normalize(v?: string): string {
    return (v || '').toString().trim().toLowerCase();
  }

  private computeTypeStatusOptions() {
    const types = new Set<string>();
    const statuses = new Set<string>();
    for (const p of this.payments || []) {
      const t = this.normalize(p.payment_type);
      const s = this.normalize(p.status);
      if (t) types.add(t);
      if (s) statuses.add(s);
    }
    // keep them sorted and display with capitalization
    const typeList = Array.from(types).sort();
    const statusList = Array.from(statuses).sort();
    this.paymentTypes = typeList.map(this.prettyLabel);
    this.paymentStatuses = statusList.map(this.prettyLabel);
    this.typeMap.clear();
    this.statusMap.clear();
    typeList.forEach(t => this.typeMap.set(this.prettyLabel(t), t));
    statusList.forEach(s => this.statusMap.set(this.prettyLabel(s), s));
  }

  private prettyLabel = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
