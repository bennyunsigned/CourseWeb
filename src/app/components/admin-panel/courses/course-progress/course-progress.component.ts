import { CommonModule } from '@angular/common';
import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CourseProgressService } from '../../../../services/course-progress.service';
import {CourseProgress} from '../../../../models/courseProgressModel';
import { VideoPlayerComponent } from '../video-player/video-player.component';

@Component({
  selector: 'app-course-progress',
  imports: [CommonModule,VideoPlayerComponent ],
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

  @ViewChildren(VideoPlayerComponent) videoPlayers!: QueryList<VideoPlayerComponent>;
  activeModuleIdx: number | null = null;
  activeVideoIdx: number | null = null;
  onVideoPlay(moduleIdx: number, videoIdx: number) {
    this.activeModuleIdx = moduleIdx;
    this.activeVideoIdx = videoIdx;
    let idx = 0;
    this.groupedModules.forEach((mod, mIdx) => {
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
    this.loadCourseProgress();
  }

  loadCourseProgress() {
    this.courseProgressService.getCourseProgress(this.courseId).subscribe({
      next: (data) => {
        this.courseProgressList = data;
        this.courseName = this.courseProgressList.length > 0 ? this.courseProgressList[0].CourseName : '';
        this.courseDescription = this.courseProgressList.length > 0 ? this.courseProgressList[0].CourseDescription : '';
        this.groupModules();
      },
      error: (err) => console.error('Error loading course progress', err)
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
    this.groupedModules = Array.from(moduleMap.values());
  }
}
