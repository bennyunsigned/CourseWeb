import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { CourseProgressService } from '../../../../services/course-progress.service';
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
}
