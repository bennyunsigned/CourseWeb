import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { environment } from '../../../../../environments/environment';
import { PublicCourseContent } from '../../../../models/publicCourseContentModel';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { CartService } from '../../../../services/cart.service';
import { decryptData } from '../../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { ReviewService, Review } from '../../../../services/review.service';

@Component({
  selector: 'app-course-content-details',
  standalone: true,
  imports: [CommonModule, DurationFormatPipe, FormsModule],
  templateUrl: './course-content-details.component.html',
  styleUrls: ['./course-content-details.component.css']
})
export class CourseContentDetailsComponent implements OnInit {
  courseId!: number;
  courseContent: PublicCourseContent | null = null;
  loading = true;
  error: string | null = null;
  reviews: Review[] = [];
  newReview: Review = { rating: 5, reviewText: '' };
  submittingReview = false;

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getUserId(): number {
    const encryptedId = localStorage.getItem('user_id');
    if (!encryptedId) return 0;
    const decryptedId = decryptData(encryptedId);
    return Number(decryptedId) || 0;
  }

  // Pagination properties
  currentPage = 0;
  modulesPerPage = 10;
  totalPages = 0;
  displayedModules: any[] = [];
  visiblePages: number[] = [];

  ngOnInit(): void {
    // Prefer encrypted query param 'cid' (like course-progress). Fall back to route param ':courseId'.
    try {
      const enc = this.route.snapshot.queryParamMap.get('cid') || '';
      if (enc) {
        const decoded = decodeURIComponent(enc);
        const decrypted = decryptData(decoded);
        const id = Number(decrypted) || null;
        if (id) {
          this.courseId = id;
        } else {
          this.courseId = Number(this.route.snapshot.paramMap.get('courseId'));
        }
      } else {
        this.courseId = Number(this.route.snapshot.paramMap.get('courseId'));
      }
    } catch (e) {
      // fallback to numeric route param
      this.courseId = Number(this.route.snapshot.paramMap.get('courseId'));
    }
    this.fetchCourseContent();
    this.loadReviews();
  }

  buyNow(courseId: number) {
    // Get logged in user id (stored encrypted in localStorage)
    const encUserId = localStorage.getItem('user_id') || '';
    const userIdStr = decryptData(encUserId);
    const userId = Number(userIdStr) || null;

    if (!userId) {
      // Show toast and redirect to login after it disappears
      this.toastr.info('Please login to purchase the course.', 'Login required', { timeOut: 3000, closeButton: true });
      setTimeout(() => this.router.navigate(['/login']), 3200);
      return;
    }

    // Use the loaded course content to compute price
    const course = this.courseContent as any;
    if (!course) {
      this.toastr.error('Course not found', 'Error', { timeOut: 3000 });
      return;
    }

    const amount = course.DiscountedPrice && course.DiscountedPrice > 0 ? course.DiscountedPrice : course.ActualPrice;

    // include user and course info in redirect url so the success page can read them after redirect
    const redirectWithParams = `${window.location.origin}/course/payment-success`;

    const payload: any = {
      amount: amount,
      purpose: `Purchase Course: ${course.CourseName}`,
      buyer_name: '',
      email: '',
      phone: '',
      redirect_url: redirectWithParams,
      payment_type: 'individual' as const,
      user_id: userId,
      course_id: String(courseId),
    };

    // Try to pre-fill buyer details from localStorage (values are stored encrypted)
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
      // don't block payment creation if decryption/read fails
      console.warn('Failed to read buyer details from localStorage', e);
    }

    this.paymentService.createPayment(payload).subscribe({
      next: (res: any) => {
        const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
        if (redirect) {
          // persist pending payment info so we can confirm after redirect
          try {
            const pending = { user_id: userId, course_id: String(courseId), amount, payment_request_id: res?.payment_request?.id || res?.id || null };
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
      error: (err) => {
        console.error('Payment create error', err);
        this.toastr.error('Failed to create payment. Please try again.', 'Payment error', { timeOut: 4000 });
      }
    });
  }

  addToCart(courseId: number, event?: Event) {
    // brief visual pulse on the clicked button
    try {
      const btn = event?.currentTarget as HTMLElement | null;
      if (btn) {
        btn.classList.add('btn-pulse');
        setTimeout(() => btn.classList.remove('btn-pulse'), 360);
      }
    } catch (e) { /* ignore */ }

    // Require login
    const encUserId = localStorage.getItem('user_id') || '';
    const userIdStr = decryptData(encUserId);
    const userId = Number(userIdStr) || null;
    if (!userId) {
      this.toastr.info('Please login to add items to cart', 'Login required', { timeOut: 3000 });
      setTimeout(() => this.router.navigate(['/login']), 3200);
      return;
    }

    // Call API to add to cart (server expects { course_id } and derives user from JWT)
    this.cartService.addToCart({ course_id: courseId }).subscribe({
      next: () => {
        this.toastr.success('Added to cart', 'Cart', { timeOut: 2000 });
      },
      error: (err) => {
        console.error('Add to cart failed', err);
        this.toastr.error('Failed to add to cart', 'Cart');
      }
    });
  }

  constructor(
    private courseProgressService: CourseProgressService,
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private cartService: CartService,
    private reviewService: ReviewService,
    private toastr: ToastrService
  ) { }

  loadReviews() {
    this.reviewService.getTop30Reviews({ courseId: Number(this.courseId) }).subscribe({
      next: (data) => {
        this.reviews = data;
      },
      error: (err) => console.error('Error loading reviews:', err)
    });
  }

  resolveReviewAvatar(review: Review): string {
    if (review.userImage) {
      if (review.userImage.startsWith('http')) return review.userImage;
      const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : '';
      const cleanPath = review.userImage.startsWith('/') ? review.userImage.substring(1) : review.userImage;
      return `${base}/${cleanPath}`;
    }
    return 'img/avatars/avatar.jpg';
  }

  submitReview() {
    if (!this.isLoggedIn()) {
      this.toastr.info('Please login to share your reviews', 'Login Required');
      this.router.navigate(['/login']);
      return;
    }
    if (this.newReview.rating < 1 || this.newReview.rating > 5) {
      this.toastr.warning('Please provide a rating between 1 and 5');
      return;
    }
    this.submittingReview = true;
    this.newReview.userId = this.getUserId();
    this.newReview.courseId = Number(this.courseId) || 0;
    this.newReview.bundleId = 0;
    this.newReview.productId = 0;

    console.log('[CourseDetails] Submitting review payload:', this.newReview);
    this.reviewService.addReview(this.newReview).subscribe({
      next: (res) => {
        this.toastr.success('Review added successfully');
        this.newReview = { rating: 5, reviewText: '' };
        this.loadReviews();
        this.submittingReview = false;
      },
      error: (err) => {
        console.error('Full error adding review:', err);
        const detail = err.error?.detail || err.error?.message || 'Make sure you are logged in.';
        this.toastr.error(`Failed to add review: ${detail}`);
        this.submittingReview = false;
      }
    });
  }

  fetchCourseContent() {
    this.loading = true;
    this.error = null;
    this.courseProgressService.getPublicCourseContent(this.courseId).subscribe({
      next: (data) => {
        this.courseContent = data;
        console.log('[CourseContent] fetched courseContent.BannerImage:', this.courseContent?.BannerImage);
        this.setupPagination();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load course content.';
        this.loading = false;
      }
    });
  }

  setupPagination() {
    const modules = this.courseContent?.Modules || [];
    this.totalPages = Math.ceil(modules.length / this.modulesPerPage);
    this.loadCurrentPage();
    this.visiblePages = this.getVisiblePages();
  }

  loadCurrentPage() {
    const modules = this.courseContent?.Modules || [];
    const startIndex = this.currentPage * this.modulesPerPage;
    const endIndex = startIndex + this.modulesPerPage;
    this.displayedModules = modules.slice(startIndex, endIndex);
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadCurrentPage();
    }
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadCurrentPage();
    }
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadCurrentPage();
    }
  }

  onModulesPerPageChange() {
    this.currentPage = 0;
    this.setupPagination();
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    for (let i = 0; i < this.totalPages; i++) {
      if (i < 5 || Math.abs(i - this.currentPage) <= 2 || i >= this.totalPages - 3) {
        pages.push(i);
      }
    }
    return pages;
  }

  // Normalize banner image url similar to available-courses component
  getBannerUrl(raw: string | undefined | null): string {
    const fallback = '/img/photos/p1.jpg';
    // Always log the incoming raw value for debugging (even if undefined/null)
    console.log('[CourseContent] getBannerUrl raw:', raw);
    if (!raw) {
      console.log('[CourseContent] getBannerUrl resolved: fallback (raw empty)');
      return fallback;
    }
    const trimmed = String(raw).trim();
    if (!trimmed) {
      console.log('[CourseContent] getBannerUrl resolved: fallback (trimmed empty)');
      return fallback;
    }
    let value = trimmed;
    // If backend returned a filesystem path without leading slash like 'home/...' normalize to '/home/...'
    if (/^home\//i.test(value)) {
      return '/' + value;
    }
    const homeIdx = value.indexOf('/home/');
    if (homeIdx !== -1) {
      const fsPath = value.substring(homeIdx);
      // Map workspace filesystem root to mediaBaseUrl so browser requests go to media server
      const workspaceRoot = '/home/ashutosh-mishra/Desktop/Apps';
      if (fsPath.startsWith(workspaceRoot)) {
        let relative = fsPath.substring(workspaceRoot.length).replace(/^\//, '');
        // Collapse immediate duplicate prefix sequences
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
        console.log('[CourseContent] getBannerUrl mapped filesystem path to', mapped);
        return mapped;
      }
      console.log('[CourseContent] getBannerUrl extracted filesystem path:', fsPath);
      return fsPath;
    }
    if ((value.startsWith('{') || value.startsWith('['))) {
      try {
        const parsed = JSON.parse(value as any);
        if (parsed) {
          value = parsed.imagePath || parsed.path || parsed.url || parsed.bannerImage || value;
          if (typeof value !== 'string') value = String(value || trimmed);
          value = value.trim();
        }
      } catch (e) {
        value = trimmed;
      }
    }
    // Absolute http(s) URLs — return as-is
    if (/^https?:\/\//i.test(value)) return value;
    // Protocol-relative URLs like //cdn.example.com/image.png
    if (/^\/\//.test(value)) return window.location.protocol + value;
    // Data URIs (embedded images) or blob URLs must be returned as-is
    if (/^data:/i.test(value) || /^blob:/i.test(value)) return value;
    // Root-relative paths (start with '/') — special-case server filesystem paths
    if (value.startsWith('/')) {
      if (/^\/home\//i.test(value)) {
        const match = value.match(/(\/(?:Uploads|uploads|Media|media|static|assets)\/.*)$/i);
        if (match && match[1]) {
          const webPath = match[1];
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          console.log('[CourseContent] getBannerUrl mapped filesystem path to', base + webPath);
          return base + webPath;
        }
        const idx = value.indexOf('/Uploads/');
        if (idx !== -1) {
          const webPath = value.substring(idx);
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          console.log('[CourseContent] getBannerUrl mapped filesystem path to', base + webPath);
          return base + webPath;
        }
        console.log('[CourseContent] getBannerUrl returning root-relative path as-is:', value);
        return value;
      }
      return value;
    }
    // Some backends return paths like 'uploads/xyz.png' or 'media/abc.png' — prefix with API origin
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) || /uploads\//i.test(value) || /media\//i.test(value)) {
      const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
      const resolved = base + '/' + value.replace(/^\//, '');
      console.log('[CourseContent] getBannerUrl resolved relative path to', resolved);
      return resolved;
    }
    // Fallback: assume it is a relative path — prefix with origin
    const fallbackResolved = window.location.origin + '/' + value.replace(/^\//, '');
    console.log('[CourseContent] getBannerUrl fallback resolved to', fallbackResolved);
    return fallbackResolved;
  }

  onBannerError(event: Event) {
    try {
      const img = event && (event.target as HTMLImageElement);
      if (img) {
        console.error('[CourseContent] image load error for src=', img.src);
        // if there's an onerror event with an error object, log it (some browsers include limited info)
        // Set fallback
        img.src = '/img/photos/p1.jpg';
      }
    } catch (e) {
      console.error('[CourseContent] error handling image error event', e);
    }
  }

  onBannerLoad(event: Event) {
    try {
      const img = event && (event.target as HTMLImageElement);
      if (img) {
        console.log('[CourseContent] image loaded successfully:', img.src);
      }
    } catch (e) {
      console.error('[CourseContent] error in onBannerLoad handler', e);
    }
  }

  getBannerStyle(raw: string | undefined | null): string {
    const url = this.getBannerUrl(raw);
    const safe = String(url).replace(/'/g, "\\'");
    return `url('${safe}')`;
  }
}
