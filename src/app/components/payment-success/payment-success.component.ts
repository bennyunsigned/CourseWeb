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

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router, private paymentService: PaymentService) { }

  ngOnInit(): void {
    // Instamojo may return payment_request_id or payment_request on redirect query params
    // Razorpay returns razorpay_payment_link_id
    this.paymentRequestId = this.route.snapshot.queryParamMap.get('payment_request_id') ||
      this.route.snapshot.queryParamMap.get('payment_request') ||
      this.route.snapshot.queryParamMap.get('razorpay_payment_link_id');

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
        console.log('Payment gateway status response:', res);
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

  confirmOnServer(paymentRequestId: string, gatewayResponse: any) {
    // Backend endpoint to finalize payment and insert records
    // Backend confirm expects body fields: payment_id, payment_type, user_id, course_id, subscription_type, amount
    // Build the payload from query params first, then fall back to pending_payment stored before redirect
    const query = this.route.snapshot.queryParamMap;
    const body: any = { payment_id: paymentRequestId };

    // payment_type may be provided by redirect; otherwise we'll infer it from pending data
    const qPaymentType = query.get('payment_type');
    if (qPaymentType) body.payment_type = qPaymentType;

    const qUserId = query.get('user_id');
    const qCourseId = query.get('course_id');
    const qSubscriptionType = query.get('subscription_type');
    const qAmount = query.get('amount');

    if (qUserId) body.user_id = Number(qUserId);
    if (qCourseId) body.course_id = qCourseId; // keep as string to preserve CSVs
    if (qSubscriptionType) body.subscription_type = qSubscriptionType;
    if (qAmount) body.amount = Number(qAmount);

    // If missing, try to read pending_payment saved before redirect
    try {
      const pendingRaw = localStorage.getItem('pending_payment');
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (!body.user_id && pending.user_id) body.user_id = Number(pending.user_id);
        // If pending contains CSVs or string course ids, prefer them. Do not coerce to Number.
        if (!body.course_id && pending.course_id) body.course_id = String(pending.course_id);
        if (!body.course_id && pending.course_ids_csv) body.course_id = String(pending.course_ids_csv);
        if (!body.amount && pending.amount) body.amount = Number(pending.amount);
        // include payment_request id if available
        if (pending.payment_request_id) {
          body.payment_request_id = pending.payment_request_id;
        }
        // subscription payments: pending may include subscription_id
        if (!body.subscription_type && pending.subscription_id) {
          body.subscription_type = String(pending.subscription_id);
        }
        // If payment_type not present, infer from pending
        if (!body.payment_type) {
          if (body.subscription_type) body.payment_type = 'subscription';
          else if (pending.product_id) body.payment_type = 'product';
          else if (pending.bundle_id) body.payment_type = 'bundle';
          else body.payment_type = 'individual';
        }
        // clear pending
        localStorage.removeItem('pending_payment');
      }
    } catch (e) {
      console.warn('Failed to parse pending payment info', e);
    }
    // If redirect contained explicit params, ensure numeric conversions where appropriate
    if (qCourseId && !body.course_id) body.course_id = qCourseId;
    if (qAmount && !body.amount) body.amount = Number(qAmount);
    if (qSubscriptionType && !body.subscription_type) body.subscription_type = qSubscriptionType;

    // Check for product/bundle IDs in query params
    const qProductId = query.get('product_id');
    const qBundleId = query.get('bundle_id');
    if (qProductId) body.product_id = Number(qProductId);
    if (qBundleId) body.bundle_id = Number(qBundleId);

    if (!body.payment_type) {
      // final fallback
      if (body.subscription_type) body.payment_type = 'subscription';
      else if (body.product_id) body.payment_type = 'product';
      else if (body.bundle_id) body.payment_type = 'bundle';
      else body.payment_type = 'individual';
    }

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

  backToHome() {
    this.router.navigate(['/']);
  }
}
