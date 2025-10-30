import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { decryptData } from '../../../utils/crypto-util';
import { ReportService } from '../../../services/report.service';
import { CourseProgressService } from '../../../services/course-progress.service';
import { LoadingService } from '../../../services/loading.service';
import { PwaService } from '../../../services/pwa.service';
import { TodoIndexeddbService, TodoItem } from '../../../services/todo-indexeddb.service';
import { PaymentService } from '../../../services/payment.service';
import { PageLoaderComponent } from '../../page-loader/page-loader.component';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, PageLoaderComponent, HighchartsChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  appName = environment.appName;

  // Role detection (simple email-based admin check)
  isAdmin = false;
  userEmail: string | null = null;

  // Admin totals + filters
  loading = false;
  error: string | null = null;
  adminData: any = null;
  startDate = '';
  endDate = '';
  todayYMD: string = this.toLocalYMD(new Date());
  validationErrors: { start?: string; end?: string } = {};
  selectedPreset: 'today' | 'last7' | 'month' | 'lastMonth' | 'ytd' | null = null;
  showCustomRange = false;

  // Highcharts (v5 standalone component; no [Highcharts] binding needed)
  chartOptions: Highcharts.Options = {};
  chartUpdateFlag = false;
  chartOptionsDaily: Highcharts.Options = {};
  chartUpdateFlagDaily = false;
  hasDailySeries = false;

  // User metric
  hasSubscription = false;
  purchasedCourseIds: number[] = [];
  totalCoursesCovered = 0;
  // Payments KPI (end-user)
  totalPaymentsAmount = 0;
  totalPaymentsCount = 0;

  // PWA prompt state
  showPwaCta = true; // always visible per request
  isSafariOnIOS = false;
  showIosHelp = false;
  canInstallPrompt = false; // enabled when beforeinstallprompt fires
  showWebInstallHelp = false; // temporary hint when prompt isn't available on web
  justInstalled = false; // show a one-time success hint after install
  browserInfo: { browser: string; platform: string } = { browser: 'unknown', platform: 'desktop' };
  installTipLines: string[] = [];

  // ---- Todos (IndexedDB) ----
  todos: TodoItem[] = [];
  newTodoText = '';
  editingId: number | null = null;
  editedText = '';
  // cooldown removed — always show CTA when not installed

  constructor(
    private reports: ReportService,
    private cps: CourseProgressService,
    private loadingService: LoadingService,
    private pwa: PwaService,
    private todoDb: TodoIndexeddbService,
    private payments: PaymentService
  ) {}

  ngOnInit() {
    this.detectRole();
    this.initPwaFlow();
    if (this.isAdmin) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      this.startDate = this.toLocalYMD(start);
      this.endDate = this.toLocalYMD(end);
      this.validateDates(true);
      this.loadAdminTotals();
    } else {
      this.loadUserCourseCoverage();
      this.loadUserPaymentsTotals();
    }

    // Load todos for current user
    this.loadTodos();
  }

  ngOnDestroy() {
    // no-op, listeners are attached to window but don’t require explicit cleanup in this simple case
  }

  private detectRole() {
    try {
      const stored = localStorage.getItem('user_email');
      if (stored) {
        const email = (decryptData(stored) || stored).trim().toLowerCase();
        this.userEmail = email;
        this.isAdmin = email === 'bennyunsigned@gmail.com';
      }
    } catch {}
  }

  // ================= PWA helpers (Dashboard scope) =================
  private now(): number { return Date.now ? Date.now() : new Date().getTime(); }
  private get isInstalled(): boolean {
    try {
      const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore
      const iosStandalone = !!(navigator as any).standalone;
      const androidRef = document.referrer && document.referrer.startsWith('android-app://');
      return !!(mq || iosStandalone || androidRef);
    } catch { return false; }
  }
  private detectSafariIOS(): boolean {
    try {
      const ua = navigator.userAgent || '';
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
      return isIOS && isSafari;
    } catch { return false; }
  }
  private initPwaFlow() {
    // Always show CTA; we still detect platform and prompt readiness
    this.isSafariOnIOS = this.detectSafariIOS();
    this.showPwaCta = true;
    this.browserInfo = this.getBrowserInfo();
    this.installTipLines = this.getInstallTipLines(this.browserInfo);
    // Subscribe to global PWA prompt availability (captured at app level)
    this.pwa.canInstallPrompt$.subscribe(v => this.canInstallPrompt = v);
    this.pwa.installed$.subscribe(inst => {
      if (inst) {
        this.justInstalled = true;
        this.showIosHelp = false; this.showWebInstallHelp = false;
      }
    });
  }

  openInstallFlow() {
    if (this.isSafariOnIOS) { this.toggleIosHelp(true); return; }
    if (!this.pwa.hasPrompt()) {
      // Prompt not available (yet or already consumed). Show a temporary inline hint.
      this.showWebInstallHelp = true;
      setTimeout(() => (this.showWebInstallHelp = false), 8000);
      return;
    }
    try {
      this.pwa.promptInstall();
    } catch { /* ignore */ }
  }
  // no dismiss button anymore
  toggleIosHelp(force?: boolean) { this.showIosHelp = force ?? !this.showIosHelp; }

  // ----- Admin side -----
  loadAdminTotals() {
    this.loading = true;
    this.loadingService.show();
    this.error = null;
    const start = this.startDate || undefined;
    const end = this.endDate || undefined;
    this.reports.getAdminTotal(start, end).subscribe({
      next: (res) => {
        try {
          this.adminData = res || { total: 0, count: 0, breakdown: [] };
          this.buildChart();
        } catch (e) {
          console.error('[Dashboard] buildChart error', e);
          this.error = 'Failed to render chart';
        } finally {
          this.loading = false;
          this.loadingService.hide();
        }
      },
      error: (err: any) => {
        console.error('[Dashboard] loadAdminTotals error', err);
        this.error = err?.message || 'Failed to load dashboard totals';
        this.loading = false;
        this.loadingService.hide();
      }
    });
  }

  applyPreset(preset: 'today' | 'last7' | 'month' | 'lastMonth' | 'ytd') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today);
    switch (preset) {
      case 'today':
        start = new Date(today); end = new Date(today); break;
      case 'last7':
        start = new Date(today); start.setDate(today.getDate() - 6); end = new Date(today); break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today); break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0); break;
      case 'ytd':
        start = new Date(today.getFullYear(), 0, 1); end = new Date(today); break;
    }
    this.startDate = this.toLocalYMD(start);
    this.endDate = this.toLocalYMD(end);
    this.selectedPreset = preset;
    if (this.validateDates(true)) this.loadAdminTotals();
  }

  onDateChange() {
    this.selectedPreset = null;
    if (this.validateDates(true)) this.loadAdminTotals();
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

  // ---- Browser detection & tips ----
  private getBrowserInfo(): { browser: string; platform: string } {
    try {
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isDesktop = !isAndroid && !isIOS;

      const isEdge = /Edg\//i.test(ua);
      const isChrome = /Chrome\//i.test(ua) && !isEdge && !/OPR\//i.test(ua) && !/Brave/i.test((navigator as any).userAgentData?.brands?.map((b:any)=>b.brand).join(' ') || '') && !/Brave/i.test(ua);
      const isOpera = /OPR\//i.test(ua);
      const isFirefox = /Firefox\//i.test(ua);
      const isSafariDesktop = /Safari\//i.test(ua) && !isChrome && !isEdge && !isOpera && isDesktop;

      const browser = isEdge ? 'edge' : isOpera ? 'opera' : isFirefox ? 'firefox' : isChrome ? 'chrome' : isSafariDesktop ? 'safari' : 'unknown';
      const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'desktop';
      return { browser, platform };
    } catch { return { browser: 'unknown', platform: 'desktop' }; }
  }

  private getInstallTipLines(info: { browser: string; platform: string }): string[] {
    // iOS handled separately with the dedicated toggle/help
    if (info.platform === 'android') {
      if (info.browser === 'firefox') {
        return ['Tap menu (⋮) → Install', 'If not shown: menu (⋮) → Add to Home screen'];
      }
      // Chromium-based (Chrome/Edge/Opera) on Android
      return ['Tap menu (⋮) → Install app', 'If not shown: menu (⋮) → Add to Home screen'];
    }
    if (info.platform === 'desktop') {
      if (info.browser === 'edge') {
        return ['Menu (…) → Apps → Install this site as an app'];
      }
      if (info.browser === 'chrome' || info.browser === 'opera') {
        return ['Click the Install icon in the address bar, or', 'Menu (⋮) → Install CourseWeb'];
      }
      if (info.browser === 'firefox') {
        return ['Desktop Firefox has limited PWA install support.', 'Use Chrome or Edge to install, or bookmark this page.'];
      }
      if (info.browser === 'safari') {
        return ['Safari (macOS): File → Add to Dock'];
      }
      return ['Use your browser menu to install this app.'];
    }
    // Fallback for any other platform
    return ['Use your browser menu to install this app.'];
  }

  private validateDates(setErrors: boolean): boolean {
    const errs: { start?: string; end?: string } = {};
    const start = this.parseLocalYMD(this.startDate || '');
    const end = this.parseLocalYMD(this.endDate || '');
    const today = this.parseLocalYMD(this.todayYMD)!;

    if (!start) errs.start = 'Start date is required';
    if (!end) errs.end = 'End date is required';
    if (start && end && start.getTime() > end.getTime()) errs.end = 'End date must be on or after start date';
    if (start && start.getTime() > today.getTime()) errs.start = 'Start date cannot be in the future';
    if (end && end.getTime() > today.getTime()) errs.end = 'End date cannot be in the future';

    if (setErrors) this.validationErrors = errs;
    return Object.keys(errs).length === 0;
  }

  private getString(obj: any, keys: string[], fallback = 'Unknown'): string {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null) return String(v);
    }
    return fallback;
  }

  // ================= Todos =================
  private currentUserKey(): string { return (this.userEmail || 'guest').toLowerCase(); }

  async loadTodos() {
    try {
      this.todos = await this.todoDb.listTodos(this.currentUserKey());
    } catch (e) {
      console.error('[Todos] load error', e);
    }
  }

  async addTodo() {
    const text = (this.newTodoText || '').trim();
    if (!text) return;
    try {
      const created = await this.todoDb.addTodo(this.currentUserKey(), text);
      this.todos = [created, ...this.todos];
      this.newTodoText = '';
    } catch (e) { console.error('[Todos] add error', e); }
  }

  async toggleComplete(t: TodoItem) {
    try {
      const updated = await this.todoDb.updateTodo({ ...t, completed: !t.completed });
      this.todos = this.todos.map(x => x.id === updated.id ? updated : x);
    } catch (e) { console.error('[Todos] toggle error', e); }
  }

  startEdit(t: TodoItem) {
    this.editingId = t.id!;
    this.editedText = t.text;
  }

  cancelEdit() {
    this.editingId = null;
    this.editedText = '';
  }

  async saveEdit(t: TodoItem) {
    const text = (this.editedText || '').trim();
    if (!text) { this.cancelEdit(); return; }
    try {
      const updated = await this.todoDb.updateTodo({ ...t, text });
      this.todos = this.todos.map(x => x.id === updated.id ? updated : x);
    } catch (e) { console.error('[Todos] save error', e); }
    this.cancelEdit();
  }

  async deleteTodo(t: TodoItem) {
    if (t.id == null) return;
    try {
      await this.todoDb.deleteTodo(t.id);
      this.todos = this.todos.filter(x => x.id !== t.id);
    } catch (e) { console.error('[Todos] delete error', e); }
  }

  private getNumber(obj: any, keys: string[], fallback = 0): number {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
    }
    return fallback;
  }

  // ----- End-user payments KPI -----
  private getUserIdFromStorage(): number | null {
    try {
      const enc = localStorage.getItem('user_id') || '';
      const dec = decryptData(enc);
      const val = Number(dec);
      return Number.isFinite(val) && val > 0 ? val : null;
    } catch { return null; }
  }

  loadUserPaymentsTotals() {
    const userId = this.getUserIdFromStorage();
    if (!userId) { this.totalPaymentsAmount = 0; this.totalPaymentsCount = 0; return; }
    this.payments.getUserPayments(userId).subscribe({
      next: (res: any) => {
        try {
          let list: any[] = [];
          if (Array.isArray(res)) list = res;
          else if (Array.isArray(res?.payments)) list = res.payments;
          else if (Array.isArray(res?.data)) list = res.data;

          // Strictly filter by current user id (client-side safety) and successful status
          const belongsToUser = (p: any) => {
            const uid = this.getNumber(p, ['user_id', 'userId', 'UserId'], NaN);
            const nested = this.getNumber(p?.user, ['id', 'Id', 'user_id'], NaN);
            return Number(uid) === userId || Number(nested) === userId;
          };
          const isSuccess = (p: any) => {
            const raw = this.getString(p, ['status', 'payment_status', 'Status', 'state'], '').toLowerCase();
            const flagTrue = (p?.success === true) || (String(p?.success).toLowerCase() === 'true') || (String(p?.is_paid).toLowerCase() === 'true');
            return flagTrue || ['success','completed','credit','paid','approved'].some(s => raw.includes(s));
          };
          const filtered = list.filter(p => belongsToUser(p) && isSuccess(p));

          const amounts = filtered.map(p => this.getNumber(p, ['amount', 'total_amount', 'Amount', 'paid_amount', 'payment_amount'], 0));
          const sum = amounts.reduce((a, b) => a + (Number(b) || 0), 0);
          this.totalPaymentsAmount = sum;
          this.totalPaymentsCount = filtered.length;
        } catch {
          this.totalPaymentsAmount = 0; this.totalPaymentsCount = 0;
        }
      },
      error: () => { this.totalPaymentsAmount = 0; this.totalPaymentsCount = 0; }
    });
  }

  private buildChart() {
    const raw = (this.adminData as any) || {};
    const breakdown = ((raw.breakdown || raw.breakdowns || raw.by_type || []) as any[]).slice();
    // Sort categories by amount descending for better readability
    breakdown.sort((a, b) => (
      this.getNumber(b, ['total_amount', 'amount', 'totalAmount']) - this.getNumber(a, ['total_amount', 'amount', 'totalAmount'])
    ));
    const categories = breakdown.map(b => this.getString(b, ['payment_type', 'type', 'paymentType', 'PaymentType']));
    const amounts = breakdown.map(b => this.getNumber(b, ['total_amount', 'amount', 'totalAmount']));
    const counts = breakdown.map(b => this.getNumber(b, ['count', 'total_count', 'totalCount']));

    this.chartOptions = {
      chart: { type: 'bar', height: 300, spacing: [8, 8, 8, 8], backgroundColor: 'transparent' },
      title: { text: undefined, style: { color: '#adb5bd' } },
      xAxis: {
        categories,
        title: { text: undefined },
        lineColor: 'rgba(255,255,255,0.08)',
        tickColor: 'rgba(255,255,255,0.08)',
        labels: { style: { color: '#ced4da' } }
      },
      yAxis: [
        { title: { text: 'Amount', style: { color: '#adb5bd' } }, gridLineColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } },
        { title: { text: 'Count', style: { color: '#adb5bd' } }, opposite: true, gridLineColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } }
      ],
      plotOptions: {
        bar: {
          borderRadius: 4,
          pointPadding: 0.1,
          groupPadding: 0.06,
          dataLabels: { enabled: true, style: { fontSize: '10px', color: '#f8f9fa' } }
        },
        spline: {
          dataLabels: { enabled: false },
          marker: { enabled: true, radius: 2 },
          lineWidth: 2
        }
      },
      tooltip: {
        shared: true,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(33,37,41,0.95)',
        style: { color: '#ffffff' },
        useHTML: true,
        formatter: function() {
          const pts = (this as any).points || [];
          const header = `<div class=\"mb-1\"><strong>${(this as any).x}</strong></div>`;
          const lines = pts.map((p: any) => {
            const valNum = typeof p.y === 'number' ? p.y : Number(p.y || 0);
            const isAmount = /amount/i.test(p.series.name);
            const formatted = isAmount ? `Rs: ${valNum.toLocaleString('en-IN')}` : `${valNum.toLocaleString()}`;
            return `<div><span style=\"color:${p.color}\">●</span> ${p.series.name}: <b>${formatted}</b></div>`;
          });
          return header + lines.join('');
        }
      },
      legend: { enabled: true },
      series: [
        { name: 'Amount', type: 'bar', data: amounts, yAxis: 0, color: '#5bc0ff' },
        { name: 'Count', type: 'spline', data: counts, yAxis: 1, color: '#b197fc' }
      ],
      credits: { enabled: false }
    };
    this.chartUpdateFlag = true;

    // Second chart: prefer backend daily totals; otherwise show counts by type as a line chart
    const daily: Array<{ date: string; total_amount: number }> = raw.daily || raw.daily_series || [];
    if (Array.isArray(daily) && daily.length) {
      const dailySorted = daily.slice().sort((a, b) => a.date.localeCompare(b.date));
      const dates = dailySorted.map(d => d.date);
      const dayAmounts = dailySorted.map(d => Number(d.total_amount || 0));
      this.chartOptionsDaily = {
        chart: { type: 'areaspline', height: 300, spacing: [8,8,8,8], backgroundColor: 'transparent' },
        title: { text: undefined, style: { color: '#adb5bd' } },
        xAxis: { categories: dates, title: { text: undefined }, lineColor: 'rgba(255,255,255,0.08)', tickColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } },
        yAxis: { title: { text: 'Amount', style: { color: '#adb5bd' } }, gridLineColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } },
        plotOptions: {
          areaspline: {
            fillOpacity: 0.25,
            marker: { enabled: false },
            dataLabels: { enabled: false }
          }
        },
        tooltip: { shared: true, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(33,37,41,0.95)' },
        legend: { enabled: false },
  series: [ { name: 'Amount', type: 'areaspline', data: dayAmounts, color: '#51cf66' } ],
        credits: { enabled: false }
      };
      this.hasDailySeries = true;
      this.chartUpdateFlagDaily = true;
    } else if (categories.length) {
      this.chartOptionsDaily = {
        chart: { type: 'column', height: 300, spacing: [8,8,8,8], backgroundColor: 'transparent' },
        title: { text: undefined, style: { color: '#adb5bd' } },
        xAxis: { categories, title: { text: undefined }, lineColor: 'rgba(255,255,255,0.08)', tickColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } },
        yAxis: { title: { text: 'Count', style: { color: '#adb5bd' } }, gridLineColor: 'rgba(255,255,255,0.08)', labels: { style: { color: '#ced4da' } } },
        plotOptions: {
          column: {
            borderRadius: 4,
            pointPadding: 0.1,
            groupPadding: 0.06,
            dataLabels: { enabled: true, style: { fontSize: '10px', color: '#f8f9fa' } }
          }
        },
        tooltip: { shared: true, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(33,37,41,0.95)' },
        legend: { enabled: false },
  series: [ { name: 'Count', type: 'column', data: counts, color: '#ffd43b' } ],
        credits: { enabled: false }
      };
      this.hasDailySeries = true; // show the fallback chart
      this.chartUpdateFlagDaily = true;
    } else {
      this.hasDailySeries = false;
    }
  }

  // ----- User side -----
  loadUserCourseCoverage() {
    this.loading = true;
    this.loadingService.show();
    this.error = null;
    // Step 1: get subscription status
    this.cps.hasActiveSubscription().subscribe({
      next: (sub) => {
        this.hasSubscription = !!sub?.has_active_subscription;
        if (!this.hasSubscription) {
          // load purchased courses then compute coverage from available list
          this.cps.getPurchasedCourses().subscribe({
            next: (pc) => { this.purchasedCourseIds = pc?.purchased_courses || []; this.fetchAllCoursesAndCompute(); },
            error: () => { this.purchasedCourseIds = []; this.fetchAllCoursesAndCompute(); }
          });
        } else {
          this.fetchAllCoursesAndCompute();
        }
      },
      error: () => { this.hasSubscription = false; this.purchasedCourseIds = []; this.fetchAllCoursesAndCompute(); }
    });
  }

  private fetchAllCoursesAndCompute() {
    // Category 0 = All (based on existing MyCourses usage); large limit
    this.cps.getPublicCourseContentByCategory(0, 1000, 0).subscribe({
      next: (all: any[]) => {
        let list = Array.isArray(all) ? all : [];
        if (!this.hasSubscription) {
          if (!this.purchasedCourseIds?.length) list = [];
          else list = list.filter(c => this.purchasedCourseIds.includes(Number(c?.CourseId)));
        }
        this.totalCoursesCovered = list.length;
        this.loading = false; this.loadingService.hide();
      },
      error: () => { this.totalCoursesCovered = 0; this.loading = false; this.loadingService.hide(); }
    });
  }
}
