import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PaymentService } from '../../services/payment.service';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-success',
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.css',
  standalone: true,
  imports: [CommonModule]
})
export class PaymentSuccessComponent implements OnInit {
  paymentRequestId: string | null = null;
  status: string = 'pending';
  message: string = '';

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private paymentService: PaymentService) {}

  ngOnInit(): void {
    // Instamojo may return payment_request_id or payment_request on redirect query params
    this.paymentRequestId = this.route.snapshot.queryParamMap.get('payment_request_id') || this.route.snapshot.queryParamMap.get('payment_request');
    if (!this.paymentRequestId) {
      this.message = 'No payment identifier found in the URL.';
      this.status = 'error';
      return;
    }

    this.checkPaymentStatus(this.paymentRequestId!);
  }

  checkPaymentStatus(paymentRequestId: string) {
    this.paymentService.getPaymentStatus(paymentRequestId).subscribe({
      next: (res: any) => {
        console.log('Instamojo payment status response:', res);
        // Instamojo may return status as 'Completed', 'Credit', 'Success', true, etc.
        const pr = res?.payment_request || res;
        const statusRaw = pr?.status || pr?.payment_status || pr?.status_code || pr?.success;
        const statusStr = (typeof statusRaw === 'string' ? statusRaw : String(statusRaw)).toLowerCase();
        const isSuccess = [
          'success', 'completed', 'credit', 'true', 'paid', 'approved'
        ].some(s => statusStr.includes(s));
        if (isSuccess) {
          this.confirmOnServer(paymentRequestId, res);
        } else {
          this.status = 'failed';
          this.message = `Payment status: ${statusStr}. Payment not successful yet.`;
        }
      },
      error: (err) => {
        console.error('Failed to fetch payment status', err);
        this.status = 'error';
        this.message = 'Failed to fetch payment status.';
      }
    });
  }

  confirmOnServer(paymentRequestId: string, instamojoResponse: any) {
    // Backend endpoint to finalize payment and insert records
    const url = `${environment.apiUrl}/instamojo/payment/confirm`;

    // Backend confirm expects body fields defined in original backend: payment_id, payment_type, user_id, course_id, subscription_type, amount
    // Try to extract user-defined fields from the redirect parameters if available
    const body: any = {
      payment_id: paymentRequestId,
      payment_type: 'individual'
    };

    // If backend can infer user and course from DB or session, that's fine. Otherwise, try to extract from query params
    const userId = this.route.snapshot.queryParamMap.get('user_id');
    const courseId = this.route.snapshot.queryParamMap.get('course_id');
    const amount = this.route.snapshot.queryParamMap.get('amount');
    if (userId) {
      body.user_id = Number(userId);
    }
    if (courseId) {
      body.course_id = Number(courseId);
    }
    if (amount) {
      body.amount = Number(amount);
    }

    // If missing, try to read pending_payment saved before redirect
    try {
      const pendingRaw = localStorage.getItem('pending_payment');
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (!body.user_id && pending.user_id) body.user_id = Number(pending.user_id);
        if (!body.course_id && pending.course_id) body.course_id = Number(pending.course_id);
        if (!body.amount && pending.amount) body.amount = Number(pending.amount);
        // include payment_request id if available
        if (pending.payment_request_id) {
          body.payment_request_id = pending.payment_request_id;
        }
        // clear pending
        localStorage.removeItem('pending_payment');
      }
    } catch (e) {
      console.warn('Failed to parse pending payment info', e);
    }
    if (courseId) body.course_id = Number(courseId);
    if (amount) body.amount = Number(amount);

    this.paymentService.confirmPayment(body).subscribe({
      next: (res: any) => {
        this.status = 'success';
        this.message = 'Payment successful and recorded.';
      },
      error: (err) => {
        console.error('Server confirm failed', err);
        this.status = 'error';
        this.message = 'Payment may be successful but server confirmation failed.';
      }
    });
  }

  backToCourses() {
    this.router.navigate(['/course/available-course']);
  }
}
