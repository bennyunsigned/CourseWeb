import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private base = `${environment.apiUrl}/api/report`;
  constructor(private http: HttpClient) {}

  getAdminTotal(start?: string, end?: string): Observable<any> {
    const qs: string[] = [];
    if (start) qs.push(`start=${encodeURIComponent(start)}`);
    if (end) qs.push(`end=${encodeURIComponent(end)}`);
    const query = qs.length ? `?${qs.join('&')}` : '';
    return this.http.get<any>(`${this.base}/admin/total${query}`);
  }

  getMyPayments(): Observable<any> {
    return this.http.get<any>(`${this.base}/payments/me`);
  }

  /**
   * Admin: Get last login for all users
   * GET /api/report/users/last-login
   * Optional client-side supported query params for future extensibility
   */
  getUsersLastLogin(params?: { start?: string; end?: string; search?: string; hasLogin?: 'yes'|'no' }): Observable<any[]> {
    const qs: string[] = [];
    if (params?.start) qs.push(`start=${encodeURIComponent(params.start)}`);
    if (params?.end) qs.push(`end=${encodeURIComponent(params.end)}`);
    if (params?.search) qs.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.hasLogin) qs.push(`hasLogin=${encodeURIComponent(params.hasLogin)}`);
    const query = qs.length ? `?${qs.join('&')}` : '';
    return this.http.get<any[]>(`${this.base}/users/last-login${query}`);
  }

  /**
   * Admin: Get total users count
   * GET /api/report/users/count
   * Response: { count: number }
   */
  getUsersCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/users/count`);
  }
}
