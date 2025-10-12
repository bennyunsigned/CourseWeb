import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService, CartItem } from '../../../services/cart.service';
import { PaymentService } from '../../../services/payment.service';
import { decryptData } from '../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  loading = false;
  selected = new Set<number>();

  constructor(private cartService: CartService, private paymentService: PaymentService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart() {
    try {
      const encUserId = localStorage.getItem('user_id') || '';
      const userIdStr = decryptData(encUserId);
      const userId = Number(userIdStr) || null;
      if (!userId) {
        this.toastr.info('Please login to view your cart', 'Login required');
        return;
      }
    } catch (e) {
      // ignore
    }
    this.loading = true;
    this.cartService.getCart().subscribe({
      next: (res) => {
        console.log('GET /api/cart response:', res);
        // Defensive mapping: backend may use different key casing
        const mapped = (res || []).map((r: any) => {
          const rawBanner = r.BannerImage ?? r.banner_image ?? r.bannerImage ?? r.Course?.BannerImage ?? r.Course?.banner_image ?? '';
          const bannerUrl = this.getBannerUrl(rawBanner);
          return ({
          CartId: r.CartId ?? r.cart_id ?? r.id ?? 0,
          UserId: r.UserId ?? r.user_id ?? r.userId ?? 0,
          CourseId: r.CourseId ?? r.course_id ?? r.courseId ?? r.Course?.id ?? 0,
          CourseName: r.CourseName ?? r.course_name ?? r.courseName ?? r.Course?.name ?? '',
          ActualPrice: r.ActualPrice ?? r.actual_price ?? r.Actual ?? r.Course?.actual_price ?? 0,
          DiscountedPrice: r.DiscountedPrice ?? r.discounted_price ?? r.discount ?? r.Course?.discounted_price ?? 0,
          // store raw/banner url and resolved url for template
          BannerImage: rawBanner,
          BannerImageUrl: bannerUrl,
          CreatedAt: r.CreatedAt ?? r.created_at ?? r.createdAt ?? '',
          Status: r.Status ?? r.status ?? 'active'
        } as any);
        });
        this.items = mapped;
        this.loading = false;
      },
      error: (err) => { this.loading = false; this.toastr.error('Failed to load cart'); console.error('Failed to GET /api/cart', err); }
    });
  }

  public isSelected(item: CartItem) {
    return this.selected.has(item.CourseId);
  }

  public toggleSelect(item: CartItem, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.selected.add(item.CourseId);
    else this.selected.delete(item.CourseId);
  }

  public toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.items.forEach(i => this.selected.add(i.CourseId));
    } else {
      this.selected.clear();
    }
  }

  get totalAmount(): number {
    return this.items.reduce((s, it) => s + (it.DiscountedPrice && it.DiscountedPrice > 0 ? it.DiscountedPrice : it.ActualPrice), 0);
  }

  get selectedTotal(): number {
    const selectedIds = Array.from(this.selected.values());
    if (selectedIds.length === 0) return 0; // zero when none selected
    const itemsToCharge = this.items.filter(i => selectedIds.includes(i.CourseId));
    return itemsToCharge.reduce((s, it) => s + (it.DiscountedPrice && it.DiscountedPrice > 0 ? it.DiscountedPrice : it.ActualPrice), 0);
  }

  // Banner image helpers (copied/adapted from available-courses)
  getBannerUrl(raw: string | undefined | null): string {
    const fallback = '/img/photos/p1.jpg';
    if (!raw) return fallback;
    const trimmed = String(raw).trim();
    if (!trimmed) return fallback;
    let value = trimmed;
    if (/^home\//i.test(value)) {
      return '/' + value;
    }
    const homeIdx = value.indexOf('/home/');
    if (homeIdx !== -1) {
      const fsPath = value.substring(homeIdx);
      const workspaceRoot = '/home/ashutosh-mishra/Desktop/Apps';
      if (fsPath.startsWith(workspaceRoot)) {
        let relative = fsPath.substring(workspaceRoot.length).replace(/^\//, '');
        try {
          const segs = relative.split('/').filter(s => s.length > 0);
          for (let L = Math.floor(segs.length / 2); L >= 1; L--) {
            const first = segs.slice(0, L).join('/');
            const second = segs.slice(L, 2 * L).join('/');
            if (first === second) {
              relative = segs.slice(0, L).concat(segs.slice(2 * L)).join('/');
              break;
            }
          }
        } catch (e) { /* ignore */ }
        const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
        const mapped = base + '/' + relative;
        return mapped;
      }
      return fsPath;
    }
    if ((value.startsWith('{') || value.startsWith('['))) {
      try {
        const parsed = JSON.parse(value);
        if (parsed) {
          value = parsed.imagePath || parsed.path || parsed.url || parsed.bannerImage || value;
          if (typeof value !== 'string') value = String(value || trimmed);
          value = value.trim();
        }
      } catch (e) { value = trimmed; }
    }
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\/\//.test(value)) return window.location.protocol + value;
    if (/^data:/i.test(value) || /^blob:/i.test(value)) return value;
    if (value.startsWith('/')) {
      if (/^\/home\//i.test(value)) {
        const match = value.match(/(\/(?:Uploads|uploads|Media|media|static|assets)\/.*)$/i);
        if (match && match[1]) {
          const webPath = match[1];
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          return base + webPath;
        }
        const idx = value.indexOf('/Uploads/');
        if (idx !== -1) {
          const webPath = value.substring(idx);
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          return base + webPath;
        }
        return value;
      }
      return value;
    }
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) || /uploads\//i.test(value) || /media\//i.test(value)) {
      const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
      return base + '/' + value.replace(/^\//, '');
    }
    return window.location.origin + '/' + value.replace(/^\//, '');
  }

  getBannerStyle(raw: string | undefined | null): string {
    const url = this.getBannerUrl(raw);
    const safe = String(url).replace(/'/g, "\\'");
    return `url('${safe}')`;
  }

  onBannerError(event: Event) {
    try {
      const img = event && (event.target as HTMLImageElement);
      if (img && img.src) {
        img.src = '/img/photos/p1.jpg';
        try {
          const parent = img.closest('.course-banner') as HTMLElement | null;
          if (parent) {
            parent.style.backgroundImage = `url('/img/photos/p1.jpg')`;
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* noop */ }
  }

  checkout() {
    if (!this.items || this.items.length === 0) {
      this.toastr.info('Your cart is empty');
      return;
    }
    // Ensure user logged in
    try {
      const encUserId = localStorage.getItem('user_id') || '';
      const userIdStr = decryptData(encUserId);
      const userId = Number(userIdStr) || null;
      if (!userId) {
        this.toastr.info('Please login to checkout', 'Login required');
        setTimeout(() => window.location.href = '/login', 1000);
        return;
      }
      // Only charge selected items; require at least one selection
      const selectedIds = Array.from(this.selected.values());
      if (selectedIds.length === 0) {
        this.toastr.info('Please select at least one course to checkout', 'Select courses');
        return;
      }
      const itemsToCharge = this.items.filter(i => selectedIds.includes(i.CourseId));
  const amount = itemsToCharge.reduce((s, it) => s + (it.DiscountedPrice && it.DiscountedPrice > 0 ? it.DiscountedPrice : it.ActualPrice), 0);
      const purpose = 'Purchase courses from cart';
      const redirectWithParams = `${window.location.origin}/course/payment-success`;
  const payload = { amount, purpose, buyer_name: '', email: '', phone: '', redirect_url: redirectWithParams, payment_type: 'cart', user_id: userId } as any;
      // Try to fill buyer details
      try {
        const rawName = localStorage.getItem('user_name') || '';
        const rawEmail = localStorage.getItem('user_email') || '';
        payload.buyer_name = decryptData(rawName) || rawName || '';
        payload.email = decryptData(rawEmail) || rawEmail || '';
      } catch (_e) {}

      // Persist pending_payment with cart info so payment-success can confirm server-side
      try {
        const courseIds = itemsToCharge.map(i => i.CourseId);
        const coursePrices = itemsToCharge.map(i => (i.DiscountedPrice && i.DiscountedPrice > 0 ? i.DiscountedPrice : i.ActualPrice));
        // add CSVs to payload so server/payment gateway receives selected course ids and prices
        payload.course_ids_csv = courseIds.join(',');
        payload.course_prices_csv = coursePrices.join(',');

        const pending = {
          user_id: userId,
          amount,
          cart_items: courseIds.map(id => ({ course_id: id })),
          course_ids_csv: courseIds.join(','),
          course_prices_csv: coursePrices.join(',')
        };
        localStorage.setItem('pending_payment', JSON.stringify(pending));
      } catch (e) { /* ignore */ }

      this.paymentService.createPayment(payload).subscribe({
        next: (res: any) => {
          const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
          if (redirect) {
            window.location.href = redirect;
          } else {
            this.toastr.error('Unable to start payment.');
            console.error('Unexpected create payment response', res);
          }
        },
        error: (err) => { console.error('Payment create error', err); this.toastr.error('Failed to create payment.'); }
      });

    } catch (e) {
      this.toastr.error('Checkout failed');
    }
  }

  // Quantity is not managed client-side

  removeItem(item: CartItem) {
    if (!confirm(`Remove ${item.CourseName} from cart?`)) return;
    this.cartService.deleteCart(item.CourseId).subscribe({
      next: () => this.loadCart(),
      error: (err) => { this.toastr.error('Failed to remove item'); console.error(err); }
    });
  }
}
