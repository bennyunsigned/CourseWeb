import { CommonModule } from '@angular/common';
import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CourseProgressService } from '../../../../services/course-progress.service';
import {CourseProgress} from '../../../../models/courseProgressModel';
import { VideoPlayerComponent } from '../video-player/video-player.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-course-progress',
  imports: [CommonModule, VideoPlayerComponent, FormsModule],
  templateUrl: './course-progress.component.html',
  styleUrls: ['./course-progress.component.css']
})
export class CourseProgressComponent implements OnInit {
  courseProgressList: CourseProgress[] = [];
  courseId = 4; // You can set this dynamically as needed
  courseName="";
  courseDescription=""; 
  groupedModules: {
    moduleName: string;
    moduleDescription: string;
    videos: CourseProgress[];
  }[] = [];

  // Pagination properties
  allModules: {
    moduleName: string;
    moduleDescription: string;
    videos: CourseProgress[];
  }[] = [];
  filteredModules: {
    moduleName: string;
    moduleDescription: string;
    videos: CourseProgress[];
  }[] = [];
  displayedModules: {
    moduleName: string;
    moduleDescription: string;
    videos: CourseProgress[];
  }[] = [];
  currentPage = 0;
  modulesPerPage = 10;
  totalPages = 0;
  isLoading = false;
  searchTerm = '';
  reviewsCount: number = 0;
  discussionsCount: number = 0;

  @ViewChildren(VideoPlayerComponent) videoPlayers!: QueryList<VideoPlayerComponent>;
  expandedModuleIdx: number | null = null;
  activeVideoIdx: number | null = null;
  onVideoPlay(moduleIdx: number, videoIdx: number) {
    this.expandedModuleIdx = moduleIdx;
    this.activeVideoIdx = videoIdx;
    let idx = 0;
    this.displayedModules.forEach((mod, mIdx) => {
      mod.videos.forEach((_, vIdx) => {
        if (!(mIdx === moduleIdx && vIdx === videoIdx)) {
          const player = this.videoPlayers.get(idx);
          if (player) player.pauseVideo();
        }
        idx++;
      });
    });
  }

  constructor(private courseProgressService: CourseProgressService) {}

  ngOnInit(): void {
    this.expandedModuleIdx = null; // Ensure all accordions are collapsed on init
    this.loadCourseProgress();
  }

  loadCourseProgress() {
    this.isLoading = true;
    this.courseProgressService.getCourseProgress(this.courseId).subscribe({
      next: (data) => {
        this.courseProgressList = data;
        this.courseName = this.courseProgressList.length > 0 ? this.courseProgressList[0].CourseName : '';
        this.courseDescription = this.courseProgressList.length > 0 ? this.courseProgressList[0].CourseDescription : '';
        this.groupModules();
        this.setupPagination();
        this.expandedModuleIdx = null; // Collapse all accordions after loading
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading course progress', err);
        this.isLoading = false;
      }
    });
  }

  groupModules() {
    const moduleMap = new Map<number, { moduleName: string; moduleDescription: string; videos: CourseProgress[] }>();
    for (const item of this.courseProgressList) {
      if (!moduleMap.has(item.ModuleId)) {
        moduleMap.set(item.ModuleId, {
          moduleName: item.ModuleName,
          moduleDescription: item.ModuleDescription,
          videos: []
        });
      }
      moduleMap.get(item.ModuleId)!.videos.push(item);
    }
    this.allModules = Array.from(moduleMap.values());
  }

  setupPagination() {
    this.applySearch();
    this.totalPages = Math.ceil(this.filteredModules.length / this.modulesPerPage);
    this.loadCurrentPage();
  }

  loadCurrentPage() {
  const startIndex = this.currentPage * this.modulesPerPage;
  const endIndex = startIndex + this.modulesPerPage;
  this.displayedModules = this.filteredModules.slice(startIndex, endIndex);
  this.groupedModules = this.displayedModules; // Keep compatibility
  this.expandedModuleIdx = null; // Collapse all accordions when page changes
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadCurrentPage();
      this.pauseAllVideos();
    }
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadCurrentPage();
      this.pauseAllVideos();
    }
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadCurrentPage();
      this.pauseAllVideos();
    }
  }

  pauseAllVideos() {
    if (this.videoPlayers) {
      this.videoPlayers.forEach(player => player.pauseVideo());
    }
  // removed reference to activeModuleIdx
    this.activeVideoIdx = null;
  }

  get paginationInfo() {
    const start = this.currentPage * this.modulesPerPage + 1;
    const end = Math.min((this.currentPage + 1) * this.modulesPerPage, this.filteredModules.length);
    return `${start}-${end} of ${this.filteredModules.length} modules`;
  }

  applySearch() {
    if (!this.searchTerm.trim()) {
      this.filteredModules = [...this.allModules];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredModules = this.allModules.filter(module =>
        module.moduleName.toLowerCase().includes(term) ||
        module.moduleDescription.toLowerCase().includes(term) ||
        module.videos.some(video => video.VideoTitle.toLowerCase().includes(term))
      );
    }
  }

  onSearchChange() {
  this.currentPage = 0; // Reset to first page when searching
  this.expandedModuleIdx = null; // Collapse all accordions on search
  this.setupPagination();
  }

  clearSearch() {
    this.searchTerm = '';
    this.onSearchChange();
  }

  shouldShowPage(pageIndex: number): boolean {
    return pageIndex < 5 || Math.abs(pageIndex - this.currentPage) <= 2 || pageIndex >= this.totalPages - 3;
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    for (let i = 0; i < this.totalPages; i++) {
      if (this.shouldShowPage(i)) {
        pages.push(i);
      }
    }
    return pages;
  }

  onModulesPerPageChange() {
  this.currentPage = 0; // Reset to first page
  this.expandedModuleIdx = null; // Collapse all accordions on per page change
  this.setupPagination();
  }

  // New methods for enhanced UI
  toggleModule(moduleIndex: number) {
    if (!this.displayedModules || this.displayedModules.length === 0) {
      this.expandedModuleIdx = null;
      return;
    }
    if (this.expandedModuleIdx === moduleIndex) {
      this.expandedModuleIdx = null;
    } else {
      this.expandedModuleIdx = moduleIndex;
    }
    this.activeVideoIdx = null;
    if (this.videoPlayers) {
      this.videoPlayers.forEach(player => player.pauseVideo());
    }
  }

  getTotalDuration(videos: CourseProgress[]): string {
    const totalSeconds = videos.reduce((total, video) => total + (parseInt(video.DurationInSeconds) || 0), 0);
    return this.formatDuration(totalSeconds);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  formatVideoDuration(durationString: string): string {
    const seconds = parseInt(durationString) || 0;
    return this.formatDuration(seconds);
  }

  getAllPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  // Enhanced search functionality
  getSearchResultsCount(): string {
    if (!this.searchTerm) {
      return `${this.allModules.length} modules`;
    }
    return `${this.filteredModules.length} of ${this.allModules.length} modules`;
  }

  // Enhanced video management
  playNextVideo() {
    if (this.expandedModuleIdx !== null && this.activeVideoIdx !== null) {
      const currentModule = this.displayedModules[this.expandedModuleIdx];
      if (currentModule && this.activeVideoIdx < currentModule.videos.length - 1) {
        // Play next video in current module
        this.onVideoPlay(this.expandedModuleIdx, this.activeVideoIdx + 1);
      } else {
        // Move to next module's first video
        const nextModuleIdx = this.expandedModuleIdx + 1;
        if (nextModuleIdx < this.displayedModules.length) {
          this.toggleModule(nextModuleIdx);
          this.onVideoPlay(nextModuleIdx, 0);
        }
      }
    }
  }

  playPreviousVideo() {
    if (this.expandedModuleIdx !== null && this.activeVideoIdx !== null) {
      if (this.activeVideoIdx > 0) {
        // Play previous video in current module
        this.onVideoPlay(this.expandedModuleIdx, this.activeVideoIdx - 1);
      } else {
        // Move to previous module's last video
        const prevModuleIdx = this.expandedModuleIdx - 1;
        if (prevModuleIdx >= 0) {
          const prevModule = this.displayedModules[prevModuleIdx];
          this.toggleModule(prevModuleIdx);
          this.onVideoPlay(prevModuleIdx, prevModule.videos.length - 1);
        }
      }
    }
  }

  // Accessibility improvements
  getModuleProgress(videos: CourseProgress[]): number {
    // Placeholder for future implementation when completion tracking is added
    return 0;
  }

  getVideoProgress(video: CourseProgress): number {
    // Placeholder for future implementation when video progress tracking is added
    return 0;
  }
}
