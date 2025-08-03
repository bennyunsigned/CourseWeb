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

  constructor(
    private courseProgressService: CourseProgressService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.courseId = Number(this.route.snapshot.paramMap.get('courseId'));
    this.fetchCourseContent();
  }

  fetchCourseContent() {
    this.loading = true;
    this.error = null;
    this.courseProgressService.getPublicCourseContent(this.courseId).subscribe({
      next: (data) => {
        this.courseContent = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load course content.';
        this.loading = false;
      }
    });
  }
}
