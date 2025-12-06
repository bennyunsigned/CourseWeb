import { Component, OnInit, ViewChild, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { CategoryMasterService } from '../../../../services/category-master.service';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { CommonModule } from '@angular/common';
import { AllCourseContent } from '../../../../models/allPublicCourseContentModel';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { Router, ActivatedRoute } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { CartService } from '../../../../services/cart.service';
import { decryptData, encryptData } from '../../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

interface CategoryTab {
  CategoryId: number;
  CategoryName: string;
}

@Component({
  selector: 'app-available-courses',
  templateUrl: './available-courses.component.html',
  styleUrls: ['./available-courses.component.css'],
  standalone: true,
  imports: [CommonModule, DurationFormatPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailableCoursesComponent implements OnInit {
  @Input() hideActions: boolean = false;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  categories: CategoryTab[] = [];
  selectedCategoryId: number = 0;
  // Store all courses per category
  categoryCourses: { [categoryId: number]: AllCourseContent[] } = {};
  // Pagination state per category
  categoryPagination: { [categoryId: number]: { currentPage: number, totalPages: number } } = {};
  coursesPerPage: number = 6;
  displayedCourses: AllCourseContent[] = [];
  hasMore: boolean = true;
  searchText: string = '';
  isLoading: boolean = false;

  // Cache for resolved banner URLs (performance optimization)
  private bannerUrlCache = new Map<string, string>();

  // Debounce search input
  private searchSubject = new Subject<string>();

  constructor(
    private categoryService: CategoryMasterService,
    private courseProgressService: CourseProgressService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private paymentService: PaymentService,
    private cartService: CartService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    // Debounce search by 300ms to avoid excessive filtering
    this.searchSubject.pipe(debounceTime(300)).subscribe(search => {
      this.searchText = search;
      this.categoryPagination[this.selectedCategoryId].currentPage = 0;
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.categoryService.getCategory().subscribe({
      next: (data) => {
        this.categories = [{ CategoryId: 0, CategoryName: 'All' }, ...data];
        this.cdr.markForCheck();
        this.onCategoryTabClick(0);
      },
      error: () => {
        this.categories = [{ CategoryId: 0, CategoryName: 'All' }];
        this.cdr.markForCheck();
      }
    });

    // If navigation included a focus query param, handle it after a short delay to allow view init
    try {
      const focus = this.activatedRoute.snapshot.queryParamMap.get('focus');
      if (focus === 'search') {
        // Wait for view to initialize
        setTimeout(() => {
          try {
            this.searchInput?.nativeElement?.focus();
            this.searchInput?.nativeElement?.select();
          } catch (e) { /* ignore */ }
        }, 120);
      }
    } catch (e) {
      // ignore if activatedRoute not available for some reason
    }
  }

  onCategoryTabClick(categoryId: number) {
    this.selectedCategoryId = categoryId;
    // If we already have courses for this category, just paginate
    if (this.categoryCourses[categoryId]) {
      if (!this.categoryPagination[categoryId]) {
        this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil(this.categoryCourses[categoryId].length / this.coursesPerPage) };
      }
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    } else {
      this.fetchAllCoursesForCategory(categoryId);
    }
  }


  fetchAllCoursesForCategory(categoryId: number) {
    this.isLoading = true;
    this.cdr.markForCheck();
    // Fetch all courses for the category (large limit)
    this.courseProgressService
      .getPublicCourseContentByCategory(categoryId, 1000, 0)
      .subscribe({
        next: (data: AllCourseContent[]) => {
          this.categoryCourses[categoryId] = data || [];
          this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil((data?.length || 0) / this.coursesPerPage) };
          this.updateDisplayedCourses();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.categoryCourses[categoryId] = [];
          this.categoryPagination[categoryId] = { currentPage: 0, totalPages: 0 };
          this.displayedCourses = [];
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  updateDisplayedCourses() {
    const catId = this.selectedCategoryId;
    const page = this.categoryPagination[catId]?.currentPage || 0;
    let allCourses = this.categoryCourses[catId] || [];
    // Filter by search text if present
    if (this.searchText.trim()) {
      const search = this.searchText.trim().toLowerCase();
      allCourses = allCourses.filter(c =>
        c.CourseName.toLowerCase().includes(search) ||
        (c.CourseDescription && c.CourseDescription.toLowerCase().includes(search))
      );
      // Update pagination for filtered results
      this.categoryPagination[catId].totalPages = Math.ceil(allCourses.length / this.coursesPerPage);
      if (this.categoryPagination[catId].currentPage >= this.categoryPagination[catId].totalPages) {
        this.categoryPagination[catId].currentPage = 0;
      }
    } else {
      // Reset pagination if not searching
      this.categoryPagination[catId].totalPages = Math.ceil((this.categoryCourses[catId]?.length || 0) / this.coursesPerPage);
    }
    const startIndex = this.categoryPagination[catId].currentPage * this.coursesPerPage;
    const endIndex = startIndex + this.coursesPerPage;
    this.displayedCourses = allCourses.slice(startIndex, endIndex);
    this.hasMore = (this.categoryPagination[catId]?.totalPages || 0) > 1;
  }

  // Normalize banner image url with caching. If it's absolute (http/https) or starts with '/', return as-is.
  getBannerUrl(raw: string | undefined | null): string {
    // Check cache first
    if (raw && this.bannerUrlCache.has(raw)) {
      return this.bannerUrlCache.get(raw)!;
    }

    const fallback = '/img/photos/p1.jpg';
    if (!raw) return fallback;
    const trimmed = String(raw).trim();
    if (!trimmed) return fallback;

    let value = trimmed;
    // If backend returned a filesystem path without leading slash like 'home/...' normalize to '/home/...'
    if (/^home\//i.test(value)) {
      value = '/' + value;
    }
    // If the string contains '/home/...' somewhere, extract from that point (normalize to leading slash)
    const homeIdx = value.indexOf('/home/');
    if (homeIdx !== -1) {
      const fsPath = value.substring(homeIdx);
      // If path is under the known workspace root, map to mediaBaseUrl so browser requests go to media server.
      const workspaceRoot = '/home/ashutosh-mishra/Desktop/Apps';
      if (fsPath.startsWith(workspaceRoot)) {
        let relative = fsPath.substring(workspaceRoot.length).replace(/^\//, '');
        // Collapse immediate duplicate prefix sequences, e.g. "Uploads/CourseImages/Uploads/CourseImages/..." -> "Uploads/CourseImages/..."
        try {
          const segs = relative.split('/').filter(s => s.length > 0);
          for (let L = Math.floor(segs.length / 2); L >= 1; L--) {
            const first = segs.slice(0, L).join('/');
            const second = segs.slice(L, 2 * L).join('/');
            if (first === second) {
              // keep one copy of the duplicated prefix
              relative = segs.slice(0, L).concat(segs.slice(2 * L)).join('/');
              break;
            }
          }
        } catch (e) {
          // ignore and use original relative
        }
        const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
        const mapped = base + '/' + relative;
        this.bannerUrlCache.set(raw, mapped);
        return mapped;
      }
      this.bannerUrlCache.set(raw, fsPath);
      return fsPath;
    }
    // Some backends return JSON-wrapped values like '{ "imagePath": "uploads/abc.png" }'
    if ((value.startsWith('{') || value.startsWith('['))) {
      try {
        const parsed = JSON.parse(value);
        if (parsed) {
          // try common keys
          value = parsed.imagePath || parsed.path || parsed.url || parsed.bannerImage || value;
          if (typeof value !== 'string') value = String(value || trimmed);
          value = value.trim();
        }
      } catch (e) {
        // not JSON, fall back to original trimmed
        value = trimmed;
      }
    }
    // Absolute http(s) URLs — return as-is
    if (/^https?:\/\//i.test(value)) {
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    // Protocol-relative URLs like //cdn.example.com/image.png
    if (/^\/\//.test(value)) {
      const result = window.location.protocol + value;
      this.bannerUrlCache.set(raw, result);
      return result;
    }
    // Data URIs (embedded images) or blob URLs must be returned as-is
    if (/^data:/i.test(value) || /^blob:/i.test(value)) {
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    // Root-relative paths (start with '/') — special-case server filesystem paths
    if (value.startsWith('/')) {
      // If the path looks like a server filesystem path (e.g. /home/username/.../Uploads/...),
      // try to extract a web-accessible subpath such as '/Uploads/...' or '/media/...' and prefix with API URL.
      if (/^\/home\//i.test(value)) {
        const match = value.match(/(\/(?:Uploads|uploads|Media|media|static|assets)\/.*)$/i);
        if (match && match[1]) {
          const webPath = match[1];
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          const result = base + webPath;
          this.bannerUrlCache.set(raw, result);
          return result;
        }
        // fallback: try to find '/Uploads/' occurring later in the string
        const idx = value.indexOf('/Uploads/');
        if (idx !== -1) {
          const webPath = value.substring(idx);
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          const result = base + webPath;
          this.bannerUrlCache.set(raw, result);
          return result;
        }
        // otherwise return as-is (browser will resolve relative to origin)
        this.bannerUrlCache.set(raw, value);
        return value;
      }
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    // Some backends return paths like 'uploads/xyz.png' or 'media/abc.png' — prefix with API origin
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) || /uploads\//i.test(value) || /media\//i.test(value)) {
      const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
      const result = base + '/' + value.replace(/^\//, '');
      this.bannerUrlCache.set(raw, result);
      return result;
    }
    // Fallback: assume it is a relative path — prefix with origin
    const result = window.location.origin + '/' + value.replace(/^\//, '');
    this.bannerUrlCache.set(raw, result);
    return result;
  }

  getBannerStyle(raw: string | undefined | null): string {
    const url = this.getBannerUrl(raw);
    // ensure any single quotes in URL are escaped
    const safe = String(url).replace(/'/g, "\\'");
    return `url('${safe}')`;
  }

  onBannerError(event: Event) {
    try {
      const img = event && (event.target as HTMLImageElement);
      if (img && img.src) {
        img.src = '/img/photos/p1.jpg';
        // also update background image on parent banner container if present
        try {
          const parent = img.closest('.course-banner') as HTMLElement | null;
          if (parent) {
            parent.style.backgroundImage = `url('/img/photos/p1.jpg')`;
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // noop
    }
  }

  onSearchTextChange() {
    // Emit search text to debounced subject instead of directly updating
    this.searchSubject.next(this.searchText);
  }

  nextPage() {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (this.categoryPagination[catId].currentPage < this.categoryPagination[catId].totalPages - 1) {
      this.categoryPagination[catId].currentPage++;
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    }
  }

  previousPage() {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (this.categoryPagination[catId].currentPage > 0) {
      this.categoryPagination[catId].currentPage--;
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    }
  }

  goToPage(page: number) {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (page >= 0 && page < this.categoryPagination[catId].totalPages) {
      this.categoryPagination[catId].currentPage = page;
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    }
  }

  onCoursesPerPageChange() {
    const catId = this.selectedCategoryId;
    if (!this.categoryCourses[catId]) return;
    this.categoryPagination[catId] = {
      currentPage: 0,
      totalPages: Math.ceil(this.categoryCourses[catId].length / this.coursesPerPage)
    };
    this.updateDisplayedCourses();
    this.cdr.markForCheck();
  }

  get visiblePages(): number[] {
    const catId = this.selectedCategoryId;
    const totalPages = this.categoryPagination[catId]?.totalPages || 0;
    const currentPage = this.categoryPagination[catId]?.currentPage || 0;
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
      let end = Math.min(totalPages - 1, start + 4);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }

  get courseRows(): any[][] {
    const rows: any[][] = [];
    for (let i = 0; i < this.displayedCourses.length; i += 4) {
      rows.push(this.displayedCourses.slice(i, i + 4));
    }
    return rows;
  }

  get categoryRows(): CategoryTab[][] {
    const rows: CategoryTab[][] = [];
    for (let i = 0; i < this.categories.length; i += 7) {
      rows.push(this.categories.slice(i, i + 7));
    }
    return rows;
  }

  // TrackBy functions for performance optimization
  trackByCourse(index: number, course: AllCourseContent): number {
    return course.CourseId;
  }

  trackByCategory(index: number, category: CategoryTab): number {
    return category.CategoryId;
  }

  onCardClick(courseId: number) {
    console.log('Navigating to course:', courseId);
    try {
      const enc = encodeURIComponent(encryptData(String(courseId)));
      this.router.navigate(['/course/course-content'], { queryParams: { cid: enc } });
    } catch (e) {
      // fallback to old numeric route param
      this.router.navigate(['/course/course-content', courseId]);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    // Focus search input when user presses '/'
    if (event.key === '/') {
      // prevent typing the slash into other focused inputs
      event.preventDefault();
      try {
        this.searchInput?.nativeElement?.focus();
        this.searchInput?.nativeElement?.select();
      } catch (e) { /* ignore */ }
    }
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

    // Find course details to get price
    const course = this.displayedCourses.find(c => c.CourseId === courseId) ||
      Object.values(this.categoryCourses).flat().find((c: any) => c.CourseId === courseId);

    if (!course) {
      this.toastr.error('Course not found', 'Error', { timeOut: 3000 });
      return;
    }

    const amount = course.DiscountedPrice && course.DiscountedPrice > 0 ? course.DiscountedPrice : course.ActualPrice;

    // include user and course info in redirect url so the success page can read them after Instamojo redirect
    const redirectWithParams = `${window.location.origin}/course/payment-success`;

    const payload = {
      amount: amount,
      purpose: `Purchase Course: ${course.CourseName}`,
      buyer_name: '',
      email: '',
      phone: '',
      redirect_url: redirectWithParams,
      payment_type: 'individual' as const,
      user_id: userId,
      // Send course_id as string to support single-course purchase
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
}
