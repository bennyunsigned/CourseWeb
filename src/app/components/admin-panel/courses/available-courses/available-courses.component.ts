import { Component, OnInit } from '@angular/core';
import { CategoryMasterService } from '../../../../services/category-master.service';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { CommonModule } from '@angular/common';
import { AllCourseContent } from '../../../../models/allPublicCourseContentModel';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { Router } from '@angular/router';

interface CategoryTab {
  CategoryId: number;
  CategoryName: string;
}

@Component({
  selector: 'app-available-courses',
  templateUrl: './available-courses.component.html',
  styleUrl: './available-courses.component.css',
  standalone: true,
  imports: [CommonModule, DurationFormatPipe],
})
export class AvailableCoursesComponent implements OnInit {
  categories: CategoryTab[] = [];
  selectedCategoryId: number = 0;
  courses: AllCourseContent[] = [];
  limit: number = 12;
  offset: number = 0;
  hasMore: boolean = true;

  constructor(
    private categoryService: CategoryMasterService,
    private courseProgressService: CourseProgressService,
    private router: Router
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
    this.offset = 0;
    this.courses = [];
    this.hasMore = true;
    this.fetchCourses();
  }

  fetchCourses() {
    this.courseProgressService
      .getPublicCourseContentByCategory(this.selectedCategoryId, this.limit, this.offset)
      .subscribe({
        next: (data: AllCourseContent[]) => {
          if (data && data.length > 0) {
            this.courses = [...this.courses, ...data];
            this.hasMore = data.length === this.limit;
          } else {
            this.hasMore = false;
          }
        },
        error: () => {
          this.hasMore = false;
        }
      });
  }

  loadMore() {
    this.offset += this.limit;
    this.fetchCourses();
  }

  get courseRows(): any[][] {
    const rows: any[][] = [];
    for (let i = 0; i < this.courses.length; i += 4) {
      rows.push(this.courses.slice(i, i + 4));
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

  buyNow(courseId: number) {
    alert('Buy Now clicked for courseId: ' + courseId);
  }

  addToCart(courseId: number) {
    alert('Add to Cart clicked for courseId: ' + courseId);
  }
}
