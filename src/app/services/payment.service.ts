import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreatePaymentPayload {
  amount: number;
  purpose: string;
  buyer_name?: string;
  email?: string;
  phone?: string;
  redirect_url?: string;
  payment_type: 'individual' | 'subscription';
  user_id: number;
  course_id?: number;
  subscription_type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private base = `${environment.apiUrl}/api/instamojo`;

  constructor(private http: HttpClient) {}

  createPayment(payload: CreatePaymentPayload): Observable<any> {
    return this.http.post(`${this.base}/payment/create`, payload);
  }

  confirmPayment(body: any): Observable<any> {
    return this.http.post(`${this.base}/payment/confirm`, body);
  }

  getPaymentStatus(paymentRequestId: string): Observable<any> {
    return this.http.get(`${this.base}/payment/status/${paymentRequestId}`);
  }

  listPayments(): Observable<any> {
    return this.http.get(`${this.base}/payment/list`);
  }

  deletePayment(paymentRequestId: string): Observable<any> {
    return this.http.delete(`${this.base}/payment/delete/${paymentRequestId}`);
  }

  getUserPayments(userId: number): Observable<any> {
    return this.http.get(`${this.base}/payment/user/${userId}`);
  }

  getUserDetails(userId: number): Observable<any> {
    return this.http.get(`${this.base}/user/details/${userId}`);
  }
}
