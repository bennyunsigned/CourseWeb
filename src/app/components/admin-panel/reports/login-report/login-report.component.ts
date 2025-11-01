import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ReportService } from '../../../../services/report.service';
import { PageLoaderComponent } from '../../../page-loader/page-loader.component';
import { LoadingService } from '../../../../services/loading.service';

@Component({
  selector: 'app-login-report',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoaderComponent],
  templateUrl: './login-report.component.html',
  styleUrl: './login-report.component.css'
})
export class LoginReportComponent {
  // Data
  loading = false;
  rows: any[] = [];
  error: string | null = null;

  // Filters
  searchText: string = '';
  startDate: string = '';
  endDate: string = '';
  today: string = new Date().toISOString().slice(0, 10);
  hasLoginFilter: '' | 'yes' | 'no' = '';
  validationErrors: { start?: string; end?: string } = {};

  // Sorting
  sortColumn: 'name' | 'email' | 'last_login_at' = 'last_login_at';
  sortAsc = false; // default: last login desc

  // Pagination
  page = 1;
  pageSize = 10;
  get total(): number { return this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageStart(): number { return (this.page - 1) * this.pageSize; }
  get pageEnd(): number { return Math.min(this.pageStart + this.pageSize, this.total); }

  private filtered: any[] = [];

  constructor(
    private reports: ReportService,
    private loadingService: LoadingService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true; this.loadingService.show(); this.error = null;
    this.reports.getUsersLastLogin().subscribe({
      next: (data) => {
        this.rows = Array.isArray(data) ? data : [];
        // Ensure expected fields exist
        for (const r of this.rows) {
          if (!('last_login_at' in r)) r.last_login_at = null;
        }
        this.applyFilters();
        this.loading = false; this.loadingService.hide();
      },
      error: (err) => {
        const detail = err?.error?.detail || err?.message || 'Failed to load login report';
        this.error = detail;
        this.toastr.error(detail, 'Login Report');
        this.loading = false; this.loadingService.hide();
      }
    });
  }

  // Filtering & sorting
  applyFilters() {
    const search = (this.searchText || '').trim().toLowerCase();
    const start = this.parseLocalYMD(this.startDate);
    const end = this.parseLocalYMD(this.endDate);
    const hasLogin = this.hasLoginFilter;

    let out = (this.rows || []).filter(u => {
      // search over name/email
      const name = (u.name || '').toString().toLowerCase();
      const email = (u.email || '').toString().toLowerCase();
      if (search && !(name.includes(search) || email.includes(search))) return false;

      // has login filter
      const has = !!u.last_login_at;
      if (hasLogin === 'yes' && !has) return false;
      if (hasLogin === 'no' && has) return false;

      // date range applies only if last_login_at exists
      if (u.last_login_at && (start || end)) {
        const dt = new Date(u.last_login_at);
        if (start) {
          const s0 = new Date(start); s0.setHours(0,0,0,0);
          if (dt < s0) return false;
        }
        if (end) {
          const e9 = new Date(end); e9.setHours(23,59,59,999);
          if (dt > e9) return false;
        }
      }
      return true;
    });

    // sort
    out = out.sort((a, b) => this.compare(a, b));

    this.filtered = out;
    this.page = 1;
  }

  compare(a: any, b: any): number {
    const col = this.sortColumn;
    let va: any = a[col];
    let vb: any = b[col];
    if (col === 'last_login_at') {
      const da = va ? new Date(va).getTime() : -Infinity;
      const db = vb ? new Date(vb).getTime() : -Infinity;
      return this.sortAsc ? (da - db) : (db - da);
    }
    va = (va || '').toString().toLowerCase();
    vb = (vb || '').toString().toLowerCase();
    const cmp = va.localeCompare(vb);
    return this.sortAsc ? cmp : -cmp;
  }

  onSearchChange() { this.applyFilters(); }

  onDateChange() {
    const ok = this.validateDates(true);
    if (ok) this.applyFilters();
  }

  onHasLoginChange() { this.applyFilters(); }

  setSort(col: 'name' | 'email' | 'last_login_at') {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      // default to desc for dates, asc for strings
      this.sortAsc = col === 'last_login_at' ? false : true;
    }
    this.applyFilters();
  }

  changePage(delta: number) {
    this.page = Math.min(this.totalPages, Math.max(1, this.page + delta));
  }

  get pageRows(): any[] {
    return this.filtered.slice(this.pageStart, this.pageEnd);
  }

  resetFilters() {
    this.searchText = '';
    this.startDate = '';
    this.endDate = '';
    this.hasLoginFilter = '';
    this.validationErrors = {};
    this.applyFilters();
  }

  // Helpers
  private parseLocalYMD(s?: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  validateDates(setErrors = false): boolean {
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
}
