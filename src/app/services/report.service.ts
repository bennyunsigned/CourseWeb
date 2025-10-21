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
}
