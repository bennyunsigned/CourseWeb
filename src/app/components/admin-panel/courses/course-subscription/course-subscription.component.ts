import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../../utils/crypto-util';

@Component({
  selector: 'app-course-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-subscription.component.html',
  styleUrls: ['./course-subscription.component.css']
})
export class CourseSubscriptionComponent {
  subscriptions = [
    { SubscriptionId: 'S06', SubscriptionName: '6 Months', SubscriptionPrice: 20, SubscriptionDescription: 'Access for six months' },
    { SubscriptionId: 'S12', SubscriptionName: '1 Year', SubscriptionPrice: 25, SubscriptionDescription: 'Access for one year' },
    { SubscriptionId: 'LFT', SubscriptionName: 'Lifetime', SubscriptionPrice: 30, SubscriptionDescription: 'Lifetime access' }
  ];

  constructor(private paymentService: PaymentService, private router: Router, private toastr: ToastrService) {}

  formatPrice(amount: number) { return `₹${amount}/-`; }

  buySubscription(s: any) {
    const encUserId = localStorage.getItem('user_id') || '';
    const userIdStr = decryptData(encUserId);
    const userId = Number(userIdStr) || null;

    if (!userId) {
      this.toastr.info('Please login to purchase a subscription.', 'Login required', { timeOut: 3000, closeButton: true });
      setTimeout(() => this.router.navigate(['/login']), 3200);
      return;
    }

    const amount = s.SubscriptionPrice;
    const redirectWithParams = `${window.location.origin}/course/payment-success`;
    const payload: any = { amount, purpose: `Subscription: ${s.SubscriptionName}`, buyer_name: '', email: '', phone: '', redirect_url: redirectWithParams, payment_type: 'subscription', user_id: userId, subscription_type: String(s.SubscriptionId) };

    try {
      const rawName = localStorage.getItem('user_name') || '';
      const rawEmail = localStorage.getItem('user_email') || '';
      const rawPhone = localStorage.getItem('user_phone') || '';
      const name = decryptData(rawName) || rawName || '';
      const email = decryptData(rawEmail) || rawEmail || '';
      const phone = decryptData(rawPhone) || rawPhone || '';
      if (name) payload.buyer_name = name;
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
    } catch (e) { console.warn('Failed to read buyer details', e); }

    this.paymentService.createPayment(payload).subscribe({
      next: (res: any) => {
        const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
        if (redirect) {
          try { const pending = { user_id: userId, subscription_id: String(s.SubscriptionId), amount, payment_request_id: res?.payment_request?.id || res?.id || null }; localStorage.setItem('pending_payment', JSON.stringify(pending)); } catch (e) { console.warn('Failed save pending', e); }
          window.location.href = redirect;
        } else { this.toastr.error('Unable to start payment.', 'Payment error'); console.error('Unexpected create payment response', res); }
      },
      error: (err: any) => { console.error('Payment create error', err); this.toastr.error('Failed to create payment. Please try again.', 'Payment error'); }
    });
  }
}
