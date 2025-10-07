import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { environment } from '../../../../../environments/environment';
import { PublicCourseContent } from '../../../../models/publicCourseContentModel';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-course-content-details',
  standalone: true,
  imports: [CommonModule, DurationFormatPipe],
  templateUrl: './course-content-details.component.html',
  styleUrls: ['./course-content-details.component.css']
})
export class CourseContentDetailsComponent implements OnInit {
  courseId!: number;
  courseContent: PublicCourseContent | null = null;
  loading = true;
  error: string | null = null;

  // Pagination properties
  currentPage = 0;
  modulesPerPage = 10;
  totalPages = 0;
  displayedModules: any[] = [];
  visiblePages: number[] = [];

  ngOnInit(): void {
    this.courseId = Number(this.route.snapshot.paramMap.get('courseId'));
    this.fetchCourseContent();
  }

  constructor(
    private courseProgressService: CourseProgressService,
    private route: ActivatedRoute
  ) {}

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
}
