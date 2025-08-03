import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CourseProgress } from '../models/courseProgressModel';
import { PublicCourseContent } from '../models/publicCourseContentModel';
import { AllCourseContent } from '../models/allPublicCourseContentModel';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CourseProgressService {

  private apiUrl = `${environment.apiUrl}/api/courseProgress`;

  constructor(private http: HttpClient) {}

  getCourseProgress(courseId: number): Observable<CourseProgress[]> {
    const url = `${this.apiUrl}/course-progress/?course_id=${courseId}`;
    return this.http.get<CourseProgress[]>(url);
  }

  getPublicCourseContent(courseId: number): Observable<PublicCourseContent> {
    const url = `${this.apiUrl}/public-course-content/?course_id=${courseId}`;
    return this.http.get<PublicCourseContent>(url);
  }

  getPublicCourseContentByCategory(categoryId: number, limit: number, offset: number): Observable<AllCourseContent[]> {
    const url = `${this.apiUrl}/public-course-content-by-category/?category_id=${categoryId}&limit=${limit}&offset=${offset}`;
    return this.http.get<AllCourseContent[]>(url);
  }
}
