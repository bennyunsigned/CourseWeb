import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreatePaymentPayload {
  amount?: number;
  purpose: string;
  buyer_name?: string;
  email?: string;
  phone?: string;
  redirect_url?: string;
  payment_type: 'individual' | 'subscription' | 'product' | 'bundle';
  user_id?: number;
  course_id?: string;
  subscription_type?: string;
  product_id?: number;
  bundle_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private base = `${environment.apiUrl}/api/payment-gateway`;

  constructor(private http: HttpClient) { }

  createPayment(payload: CreatePaymentPayload): Observable<any> {
    return this.http.post(`${this.base}/payment/create`, payload);
  }

  confirmPayment(body: any): Observable<any> {
    return this.http.post(`${this.base}/payment/confirm`, body);
  }

  getPaymentStatus(paymentRequestId: string): Observable<any> {
    return this.http.get(`${this.base}/status/${paymentRequestId}`);
  }

  listPayments(): Observable<any> {
    return this.http.get(`${this.base}/list`);
  }

  deletePayment(paymentRequestId: string): Observable<any> {
    return this.http.delete(`${this.base}/delete/${paymentRequestId}`);
  }

  getUserPayments(userId: number): Observable<any> {
    return this.http.get(`${this.base}/payment/user/${userId}`);
  }

  getUserDetails(userId: number): Observable<any> {
    return this.http.get(`${this.base}/user/details/${userId}`);
  }
}
