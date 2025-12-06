import { Component, OnInit, ViewChild, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { decryptData, encryptData } from '../../../../utils/crypto-util';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { CategoryMasterService } from '../../../../services/category-master.service';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-my-courses',
  standalone: true,
  imports: [CommonModule, DurationFormatPipe, FormsModule, RouterModule],
  templateUrl: './my-courses.component.html',
  styleUrls: ['./my-courses.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyCoursesComponent implements OnInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  categories: { CategoryId: number; CategoryName: string }[] = [];
  selectedCategoryId = 0;
  categoryCourses: { [categoryId: number]: any[] } = {};
  categoryPagination: { [categoryId: number]: { currentPage: number; totalPages: number } } = {};
  coursesPerPage = 6;
  displayedCourses: any[] = [];
  hasMore = true;
  searchText = '';

  hasSubscription = false;
  purchasedCourseIds: number[] = [];
  
  private bannerUrlCache = new Map<string, string>();
  private searchSubject = new Subject<string>();

  constructor(
    private categoryService: CategoryMasterService,
    private cps: CourseProgressService,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
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
        // check subscription and fetch initial category
        this.cps.hasActiveSubscription().subscribe({
          next: (res) => {
            this.hasSubscription = !!res?.has_active_subscription;
            if (!this.hasSubscription) {
              this.cps.getPurchasedCourses().subscribe({ 
                next: (d) => { 
                  this.purchasedCourseIds = d?.purchased_courses || []; 
                  this.cdr.markForCheck();
                  this.onCategoryTabClick(0); 
                }, 
                error: () => { 
                  this.purchasedCourseIds = []; 
                  this.cdr.markForCheck();
                  this.onCategoryTabClick(0); 
                } 
              });
            } else {
              this.onCategoryTabClick(0);
            }
          },
          error: () => { 
            this.hasSubscription = false; 
            this.purchasedCourseIds = []; 
            this.cdr.markForCheck();
            this.onCategoryTabClick(0); 
          }
        });
      },
      error: () => { 
        this.categories = [{ CategoryId: 0, CategoryName: 'All' }]; 
        this.cdr.markForCheck();
        this.onCategoryTabClick(0); 
      }
    });
  }

  onCategoryTabClick(categoryId: number) {
    this.selectedCategoryId = categoryId;
    if (this.categoryCourses[categoryId]) {
      if (!this.categoryPagination[categoryId]) this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil(this.categoryCourses[categoryId].length / this.coursesPerPage) };
      this.updateDisplayedCourses();
      this.cdr.markForCheck();
    } else {
      this.fetchAllCoursesForCategory(categoryId);
    }
  }

  fetchAllCoursesForCategory(categoryId: number) {
    this.cps.getPublicCourseContentByCategory(categoryId, 1000, 0).subscribe({
      next: (data: any[]) => {
        let list = data || [];
        // If the user does not have a subscription and has no purchased courses,
        // don't show all courses — show an empty list instead.
        if (!this.hasSubscription) {
          if (!this.purchasedCourseIds || !this.purchasedCourseIds.length) {
            list = [];
          } else {
            list = list.filter(c => this.purchasedCourseIds.includes(Number(c.CourseId)));
          }
        }
        this.categoryCourses[categoryId] = list;
        this.categoryPagination[categoryId] = { currentPage: 0, totalPages: Math.ceil((list?.length || 0) / this.coursesPerPage) };
        this.updateDisplayedCourses();
        this.cdr.markForCheck();
      },
      error: (err) => { 
        this.categoryCourses[categoryId] = []; 
        this.categoryPagination[categoryId] = { currentPage: 0, totalPages: 0 }; 
        this.displayedCourses = []; 
        this.cdr.markForCheck();
        console.error('Failed to fetch courses', err); 
      }
    });
  }

  updateDisplayedCourses() {
    const catId = this.selectedCategoryId;
    const page = this.categoryPagination[catId]?.currentPage || 0;
    let allCourses = this.categoryCourses[catId] || [];
    if (this.searchText.trim()) {
      const search = this.searchText.trim().toLowerCase();
      allCourses = allCourses.filter(c => c.CourseName.toLowerCase().includes(search) || (c.CourseDescription && c.CourseDescription.toLowerCase().includes(search)));
      this.categoryPagination[catId].totalPages = Math.ceil(allCourses.length / this.coursesPerPage);
      if (this.categoryPagination[catId].currentPage >= this.categoryPagination[catId].totalPages) this.categoryPagination[catId].currentPage = 0;
    } else {
      this.categoryPagination[catId].totalPages = Math.ceil((this.categoryCourses[catId]?.length || 0) / this.coursesPerPage);
    }
    const startIndex = this.categoryPagination[catId].currentPage * this.coursesPerPage;
    const endIndex = startIndex + this.coursesPerPage;
    this.displayedCourses = allCourses.slice(startIndex, endIndex);
    this.hasMore = (this.categoryPagination[catId]?.totalPages || 0) > 1;
  }

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
    if (/^home\//i.test(value)) {
      value = '/' + value;
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
        } catch (e) {}
        const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
        const mapped = base + '/' + relative;
        this.bannerUrlCache.set(raw, mapped);
        return mapped;
      }
      this.bannerUrlCache.set(raw, fsPath);
      return fsPath;
    }
    if ((value.startsWith('{') || value.startsWith('[')) ) {
      try {
        const parsed = JSON.parse(value);
        if (parsed) {
          value = parsed.imagePath || parsed.path || parsed.url || parsed.bannerImage || value;
          if (typeof value !== 'string') value = String(value || trimmed);
          value = value.trim();
        }
      } catch (e) {
        value = trimmed;
      }
    }
    if (/^https?:\/\//i.test(value)) {
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    if (/^\/\//.test(value)) {
      const result = window.location.protocol + value;
      this.bannerUrlCache.set(raw, result);
      return result;
    }
    if (/^data:/i.test(value) || /^blob:/i.test(value)) {
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    if (value.startsWith('/')) {
      if (/^\/home\//i.test(value)) {
        const match = value.match(/(\/(?:Uploads|uploads|Media|media|static|assets)\/.*)$/i);
        if (match && match[1]) {
          const webPath = match[1];
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          const result = base + webPath;
          this.bannerUrlCache.set(raw, result);
          return result;
        }
        const idx = value.indexOf('/Uploads/');
        if (idx !== -1) {
          const webPath = value.substring(idx);
          const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
          const result = base + webPath;
          this.bannerUrlCache.set(raw, result);
          return result;
        }
        this.bannerUrlCache.set(raw, value);
        return value;
      }
      this.bannerUrlCache.set(raw, value);
      return value;
    }
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) || /uploads\//i.test(value) || /media\//i.test(value)) {
      const base = environment?.apiUrl ? environment.apiUrl.replace(/\/$/, '') : window.location.origin;
      const result = base + '/' + value.replace(/^\//, '');
      this.bannerUrlCache.set(raw, result);
      return result;
    }
    const result = window.location.origin + '/' + value.replace(/^\//, '');
    this.bannerUrlCache.set(raw, result);
    return result;
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
    } catch (e) {}
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

  // TrackBy functions for performance optimization
  trackByCourse(index: number, course: any): number {
    return course.CourseId;
  }

  trackByCategory(index: number, category: any): number {
    return category.CategoryId;
  }

  onCardClick(courseId: number) {
    try {
      const enc = encodeURIComponent(encryptData(String(courseId)));
      this.router.navigate(['/course/course-progress'], { queryParams: { cid: enc } });
    } catch (e) {
      console.error('Failed to navigate to course', e);
      this.toastr.error('Unable to open course', 'Error');
    }
  }
}
