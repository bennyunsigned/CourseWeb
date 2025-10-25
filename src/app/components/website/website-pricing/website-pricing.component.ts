import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../../services/payment.service';
import { ToastrService } from 'ngx-toastr';
import { decryptData } from '../../../utils/crypto-util';

@Component({
  selector: 'app-website-pricing',
  imports: [CommonModule],
  templateUrl: './website-pricing.component.html',
  styleUrl: './website-pricing.component.css'
})
export class WebsitePricingComponent {
  // Subscriptions list used by the template. Each item has an id, name, price and description.
  subscriptions = [
    {
      SubscriptionId: 'S06',
      SubscriptionName: '6 Month Subscription',
      SubscriptionPrice: 599,
      SubscriptionDescription: 'Unlimited access to a curated set of courses for 6 months. Great for intermediate plans.'
    },
    {
      SubscriptionId: 'S12',
      SubscriptionName: '1 Year Subscription',
      SubscriptionPrice: 999,
      SubscriptionDescription: 'Unlimited access to all courses for 1 year. Best for medium-term learners.'
    },
    {
      SubscriptionId: 'LFT',
      SubscriptionName: 'Lifetime Access',
      SubscriptionPrice: 4999,
      SubscriptionDescription: 'Lifetime access to all courses. The ultimate plan for lifelong learners.',
      SubscriptionColor: 'powderblue'
    }
  ];

  // Helper to format price for display
  formatPrice(amount: number): string {
    return `₹${amount}/-`;
  }

  constructor(private paymentService: PaymentService, private router: Router, private toastr: ToastrService) {}

  buySubscription(s: any) {
    console.log('[WebsitePricing] buySubscription called for', s);
    // Verify login
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

    const payload: any = {
      amount: amount,
      purpose: `Subscription: ${s.SubscriptionName}`,
      buyer_name: '',
      email: '',
      phone: '',
      redirect_url: redirectWithParams,
      payment_type: 'subscription',
      user_id: userId,
      subscription_type: String(s.SubscriptionId)
    };

    // Try to pre-fill buyer details from localStorage (values may be encrypted)
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
    } catch (e) {
      console.warn('Failed to read buyer details from localStorage', e);
    }

    this.paymentService.createPayment(payload).subscribe({
      next: (res: any) => {
        const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
        if (redirect) {
          try {
            const pending = { user_id: userId, subscription_id: String(s.SubscriptionId), amount, payment_request_id: res?.payment_request?.id || res?.id || null };
            localStorage.setItem('pending_payment', JSON.stringify(pending));
          } catch (e) {
            console.warn('Failed to save pending payment info', e);
          }
          window.location.href = redirect;
        } else {
          this.toastr.error('Unable to start payment.', 'Payment error', { timeOut: 4000 });
          console.error('Unexpected create payment response', res);
        }
      },
        error: (err: any) => {
          console.error('Payment create error', err);
          this.toastr.error('Failed to create payment. Please try again.', 'Payment error', { timeOut: 4000 });
        }
    });
  }

  // Navigate to available courses page and instruct it to focus/scroll the search input
  goToAvailableCourses() {
    // If the page already contains the #available-courses element (we're on the website landing page),
    // scroll to it and focus the search input. Otherwise navigate to the route that shows it.
    try {
      const el = document.getElementById('available-courses');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Try to focus any input inside that section (search input has id or name 'searchInput' in the component)
        setTimeout(() => {
          try {
            const input = el.querySelector('input[type="search"], input[type="text"], input') as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.select?.();
            }
          } catch (e) { /* ignore */ }
        }, 250);
        return;
      }
    } catch (e) {
      // ignore DOM errors
    }

    // If not present on the current page, navigate to the website base with a fragment so the page will land on that section.
    // Many pages link to '#available-courses' from the navbar — emulate that.
    this.router.navigate(['/'], { fragment: 'available-courses' }).catch(() => {
      // fallback: navigate to the dedicated available-course route if root navigation fails
      this.router.navigate(['/course/available-course'], { queryParams: { focus: 'search' } });
    });
  }
}
