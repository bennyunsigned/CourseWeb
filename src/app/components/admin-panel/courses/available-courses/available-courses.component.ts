import { Component, OnInit } from '@angular/core';
import { CategoryMasterService } from '../../../../services/category-master.service';
import { CourseProgressService } from '../../../../services/course-progress.service';
import { CommonModule } from '@angular/common';
import { AllCourseContent } from '../../../../models/allPublicCourseContentModel';
import { DurationFormatPipe } from '../../../../pipes/duration-format.pipe';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../services/payment.service';
import { decryptData } from '../../../../utils/crypto-util';
import { FormsModule } from '@angular/forms';

interface CategoryTab {
  CategoryId: number;
  CategoryName: string;
}

@Component({
  selector: 'app-available-courses',
  templateUrl: './available-courses.component.html',
  styleUrl: './available-courses.component.css',
  standalone: true,
  imports: [CommonModule, DurationFormatPipe, FormsModule],
})
export class AvailableCoursesComponent implements OnInit {
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

  addToCart(courseId: number) {
    alert('Add to Cart clicked for courseId: ' + courseId);
  }
}
