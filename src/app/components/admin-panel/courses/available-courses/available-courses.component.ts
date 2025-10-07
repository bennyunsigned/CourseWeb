import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CategoryMasterService } from '../../../../services/category-master.service';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { CommonModule } from '@angular/common';
import { AllCourseContent } from '../../../../models/allPublicCourseContentModel';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { decryptData } from '../../../../utils/crypto-util';
import { environment } from '../../../../../environments/environment';
import { FormsModule } from '@angular/forms';

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
})
export class AvailableCoursesComponent implements OnInit {
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
  // Enable verbose logging for image URLs
  debugImageUrls = true;

  constructor(
    private categoryService: CategoryMasterService,
    private courseProgressService: CourseProgressService,
    private router: Router,
    private paymentService: PaymentService
  ) {}

  ngOnInit(): void {
    this.categoryService.getCategory().subscribe({
      next: (data) => {
        this.categories = [{ CategoryId: 0, CategoryName: 'All' }, ...data];
        this.onCategoryTabClick(0);
      },
      error: () => {
        this.categories = [{ CategoryId: 0, CategoryName: 'All' }];
      }
    });
  }

  onCategoryTabClick(categoryId: number) {
    this.selectedCategoryId = categoryId;
    // If we already have courses for this category, just paginate
    if (this.categoryCourses[categoryId]) {
      if (!this.categoryPagination[categoryId]) {
        this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil(this.categoryCourses[categoryId].length / this.coursesPerPage) };
      }
      this.updateDisplayedCourses();
    } else {
      this.fetchAllCoursesForCategory(categoryId);
    }
  }


  fetchAllCoursesForCategory(categoryId: number) {
    // Fetch all courses for the category (large limit)
    this.courseProgressService
      .getPublicCourseContentByCategory(categoryId, 1000, 0)
      .subscribe({
        next: (data: AllCourseContent[]) => {
          this.categoryCourses[categoryId] = data || [];
          this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil((data?.length || 0) / this.coursesPerPage) };
          this.updateDisplayedCourses();
        },
        error: () => {
          this.categoryCourses[categoryId] = [];
          this.categoryPagination[categoryId] = { currentPage: 0, totalPages: 0 };
          this.displayedCourses = [];
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
    // Debug: log image URLs returned for displayed courses
    if (this.debugImageUrls) {
      this.displayedCourses.forEach(c => {
        console.log('[AvailableCourses] raw BannerImage for course', c.CourseId, ':', c.BannerImage);
        try {
          const resolved = this.getBannerUrl(c.BannerImage);
          console.log('[AvailableCourses] resolved BannerImage URL for course', c.CourseId, ':', resolved);
        } catch (e) {
          console.error('[AvailableCourses] error resolving BannerImage for course', c.CourseId, e);
        }
      });
    }
  }

  // Normalize banner image url. If it's absolute (http/https) or starts with '/', return as-is.
  // Otherwise prefix with origin. If missing/empty, return a local fallback image.
  getBannerUrl(raw: string | undefined | null): string {
    const fallback = '/img/photos/p1.jpg';
    if (!raw) return fallback;
    const trimmed = String(raw).trim();
    if (!trimmed) return fallback;
    let value = trimmed;
    // If backend returned a filesystem path without leading slash like 'home/...' normalize to '/home/...'
    if (/^home\//i.test(value)) {
      return '/' + value;
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
          return mapped;
        }
        return fsPath;
    }
    // Some backends return JSON-wrapped values like '{ "imagePath": "uploads/abc.png" }'
    if ((value.startsWith('{') || value.startsWith('[')) ) {
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
    if (/^https?:\/\//i.test(value)) return value;
    // Protocol-relative URLs like //cdn.example.com/image.png
    if (/^\/\//.test(value)) return window.location.protocol + value;
    // Data URIs (embedded images) or blob URLs must be returned as-is
    if (/^data:/i.test(value) || /^blob:/i.test(value)) return value;
    // Root-relative paths (start with '/') — special-case server filesystem paths
    if (value.startsWith('/')) {
      // If the path looks like a server filesystem path (e.g. /home/username/.../Uploads/...),
      // try to extract a web-accessible subpath such as '/Uploads/...' or '/media/...' and prefix with API URL.
      if (/^\/home\//i.test(value)) {
        const match = value.match(/(\/(?:Uploads|uploads|Media|media|static|assets)\/.*)$/i);
        if (match && match[1]) {
          const webPath = match[1];
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          return base + webPath;
        }
        // fallback: try to find '/Uploads/' occurring later in the string
        const idx = value.indexOf('/Uploads/');
        if (idx !== -1) {
          const webPath = value.substring(idx);
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          return base + webPath;
        }
        // otherwise return as-is (browser will resolve relative to origin)
        return value;
      }
      return value;
    }
    // Some backends return paths like 'uploads/xyz.png' or 'media/abc.png' — prefix with API origin
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) || /uploads\//i.test(value) || /media\//i.test(value)) {
      // Use configured API URL if available, otherwise window.origin
  const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
  return base + '/' + value.replace(/^\//, '');
    }
    // Fallback: assume it is a relative path — prefix with origin
    return window.location.origin + '/' + value.replace(/^\//, '');
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
    this.categoryPagination[this.selectedCategoryId].currentPage = 0;
    this.updateDisplayedCourses();
  }

  nextPage() {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (this.categoryPagination[catId].currentPage < this.categoryPagination[catId].totalPages - 1) {
      this.categoryPagination[catId].currentPage++;
      this.updateDisplayedCourses();
    }
  }

  previousPage() {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (this.categoryPagination[catId].currentPage > 0) {
      this.categoryPagination[catId].currentPage--;
      this.updateDisplayedCourses();
    }
  }

  goToPage(page: number) {
    const catId = this.selectedCategoryId;
    if (!this.categoryPagination[catId]) return;
    if (page >= 0 && page < this.categoryPagination[catId].totalPages) {
      this.categoryPagination[catId].currentPage = page;
      this.updateDisplayedCourses();
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

  onCardClick(courseId: number) {
    console.log('Navigating to course:', courseId);
    this.router.navigate(['/course/course-content', courseId]);
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
      alert('Please login to purchase the course.');
      this.router.navigate(['/login']);
      return;
    }

    // Find course details to get price
    const course = this.displayedCourses.find(c => c.CourseId === courseId) ||
      Object.values(this.categoryCourses).flat().find((c: any) => c.CourseId === courseId);

    if (!course) {
      alert('Course not found');
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
      // NOTE: do not send course_id in create payload — backend create may not have this column
    };

    this.paymentService.createPayment(payload).subscribe({
      next: (res: any) => {
        const redirect = res?.payment_request?.longurl || res?.payment_request?.payment_url || res?.longurl;
        if (redirect) {
          // persist pending payment info so we can confirm after redirect
          try {
            const pending = { user_id: userId, course_id: courseId, amount, payment_request_id: res?.payment_request?.id || res?.id || null };
            localStorage.setItem('pending_payment', JSON.stringify(pending));
          } catch (e) {
            console.warn('Failed to save pending payment info', e);
          }
          window.location.href = redirect;
        } else {
          alert('Unable to start payment.');
          console.error('Unexpected create payment response', res);
        }
      },
      error: (err) => {
        console.error('Payment create error', err);
        alert('Failed to create payment. Please try again.');
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
    alert('Add to Cart clicked for courseId: ' + courseId);
  }
}
