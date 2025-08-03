import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CourseMasterService } from '../../../../services/course-master.service';
import { CourseModuleService } from '../../../../services/course-module.service';
import { ToastrService } from 'ngx-toastr';
import { ModuleVideoRequest, ModuleVideoResponse } from '../../../../models/courseModuleModel';
import { HttpEventType } from '@angular/common/http';


@Component({
  selector: 'app-course-module',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './course-module.component.html',
  styleUrl: './course-module.component.css'
})
export class CourseModuleComponent implements OnInit {
  ActiveTab = 'Add';
  moduleForm!: FormGroup;
  searchText: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;
  paginatedData: any[] = [];
  courses: any[] = [];
  coursesView: any[] = [];
  modules: any[] = [];
  filteredModules: any[] = [];
  selectedModuleId: string | null = null;
  selectedCourseId: string | null = "0";
  sortColumn: string = '';
  sortDirection: boolean = true;

  // Attachment/Video Modal
  selectedAttachmentModuleId: number | null = null;
  selectedAttachmentModuleName: string | null = null;
  selectedAttachmentCourseName: string | null = null;
  selectedAttachmentCourseId: number | null = null;
  attachmentFiles: File[] = [];
  newVideoUrl: string = '';
  moduleVideoName: string = '';
  isFetchingDuration: boolean = false;
  videoUrls: ModuleVideoResponse[] = [];
  downloadProgress: number = 0;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseMasterService,
    private moduleService: CourseModuleService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.moduleForm = this.fb.group({
      CourseId: ['0', Validators.required],
      ModuleName: ['', Validators.required],
      ModuleDescription: ['', Validators.required],
      SequenceNo: ['', [Validators.required]],
      Status: ["Active"],
    });

    this.loadCourses();
    this.loadModules();
  }

  changeActiveTab(tabName: string) {
    this.ActiveTab = tabName;
    if (tabName === 'Add') {
      this.resetForm();
      this.moduleForm.get('CourseId')?.setValue('0');
    }
  }

  onSubmit(): void {
    if (this.moduleForm.invalid) {
      this.toastr.warning('Please fill all required fields.', 'Validation Error');
      return;
    }

    const courseIdValue = this.moduleForm.value.CourseId;
    if (!courseIdValue || courseIdValue === '0') {
      this.toastr.warning('Please select a valid Course.', 'Validation Error');
      return;
    }

    if (this.selectedModuleId) {
      const payload = {
        ...this.moduleForm.value,
        CourseId: Number(courseIdValue)
      };
      this.moduleService.updateModule(this.selectedModuleId, payload).subscribe({
        next: () => {
          this.toastr.success('Module updated successfully!', 'Success');
          this.resetForm();
          this.loadModules();
        },
        error: (err) => {
          console.error(err);
          this.toastr.error('Failed to update Module.', 'Error');
        },
      });
    } else {
      this.moduleService.createModule({
        ...this.moduleForm.value,
        CourseId: Number(courseIdValue)
      }).subscribe({
        next: () => {
          this.toastr.success('Module created successfully!', 'Success');
          this.resetForm();
          this.loadModules();
        },
        error: (err) => {
          console.error(err);
          this.toastr.error('Failed to create Module.', 'Error');
        },
      });
    }
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (data) => {
        this.courses = data;
        this.coursesView = data;
      },
      error: (err) => {
        console.error(err);
        this.toastr.error('Failed to load courses.', 'Error');
      }
    });
  }

  loadModules(): void {
    this.moduleService.getModules(this.selectedCourseId ? Number(this.selectedCourseId) : 0).subscribe({
      next: (data) => {
        this.modules = data;
        this.filterData();
      },
      error: (err) => {
        console.error(err);
        this.toastr.error('Failed to load Modules.', 'Error');
      }
    });
  }

  editModule(ModuleId: number): void {
    this.moduleService.getModuleById(ModuleId.toString()).subscribe({
      next: (module) => {
        this.changeActiveTab('Add');
        this.selectedModuleId = ModuleId.toString();

        this.moduleForm.patchValue({
          CourseId: module.CourseId.toString(),
          ModuleName: module.ModuleName,
          ModuleDescription: module.ModuleDescription,
          SequenceNo: module.SequenceNo.toString(),
          Status: module.Status,
        });
      },
      error: (err) => {
        console.error(err);
        this.toastr.error('Failed to fetch Module details.', 'Error');
      }
    });
  }

  deleteModule(ModuleId: number): void {
    if (confirm('Are you sure you want to delete this course?')) {
      this.moduleService.deleteModule(ModuleId.toString()).subscribe({
        next: () => {
          this.moduleService.getModules(this.selectedCourseId ? Number(this.selectedCourseId) : 0).subscribe({
            next: (data) => {
              this.modules = data;
              this.filterData();
              this.toastr.success('Module deleted successfully!', 'Success');
            },
            error: (err) => {
              console.error(err);
              this.toastr.error('Failed to reload modules after delete.', 'Error');
            }
          });
        },
        error: (err) => {
          console.error(err);
          this.toastr.error('Failed to delete Module.', 'Error');
        }
      });
    }
  }

  filterData(): void {
    const search = this.searchText.toLowerCase();
    this.filteredModules = this.modules.filter(module =>
      Object.values(module).some(value =>
        value !== null &&
        value !== undefined &&
        String(value).toLowerCase().includes(search)
      )
    );

    this.totalPages = Math.ceil(this.filteredModules.length / this.itemsPerPage);
    this.goToPage(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const startIndex = (page - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedData = this.filteredModules.slice(startIndex, endIndex);
  }

  resetForm(): void {
    this.moduleForm.reset({
      CourseId: '0',
      ModuleName: '',
      ModuleDescription: '',
      SequenceNo: '',
      Status: 'Active',
    });
    this.selectedModuleId = null;
  }

  sortData(column: string): void {
    this.sortDirection = this.sortColumn === column ? !this.sortDirection : true;
    this.sortColumn = column;

    this.filteredModules.sort((a, b) => {
      const valueA = a[column]?.toString().toLowerCase() || '';
      const valueB = b[column]?.toString().toLowerCase() || '';
      return this.sortDirection ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

    this.goToPage(1);
  }

  setItemsPerPage(items: number | string): void {
    if (items === 'all') {
      this.itemsPerPage = this.filteredModules.length;
    } else {
      this.itemsPerPage = Number(items);
    }
    this.currentPage = 1;
    this.filterData();
  }

  private formatDate(date: string): string {
    const parsedDate = new Date(date);
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateRangeValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const startDate = formGroup.get('start_date')?.value;
      const endDate = formGroup.get('end_date')?.value;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return { dateRangeInvalid: true };
      }
      return null;
    };
  }

  onSequenceNoChange(moduleId: number, newValue: string) {
    const sequenceNo = Number(newValue);
    if (!Number.isNaN(sequenceNo)) {
      this.moduleService.getModuleById(moduleId.toString()).subscribe({
        next: (module) => {
          const updatedModule = {
            ...module,
            SequenceNo: sequenceNo.toString(),
            CourseId: module.CourseId
          };
          this.moduleService.updateModule(moduleId.toString(), updatedModule).subscribe({
            next: () => {
              this.toastr.success('Sequence No. updated!', 'Success');
              const localModule = this.modules.find(m => m.ModuleId === moduleId);
              if (localModule) localModule.SequenceNo = sequenceNo;
            },
            error: () => {
              this.toastr.error('Failed to update Sequence No.', 'Error');
            }
          });
        },
        error: () => {
          this.toastr.error('Failed to fetch Module details.', 'Error');
        }
      });
    }
  }

  onModuleNameChange(moduleId: number, newValue: string) {
    if (!newValue.trim()) {
      this.toastr.warning('Module Name cannot be empty.', 'Validation Error');
      return;
    }
    this.moduleService.getModuleById(moduleId.toString()).subscribe({
      next: (module) => {
        const updatedModule = {
          ...module,
          ModuleName: newValue,
          CourseId: module.CourseId
        };
        this.moduleService.updateModule(moduleId.toString(), updatedModule).subscribe({
          next: () => {
            this.toastr.success('Module Name updated!', 'Success');
            const localModule = this.modules.find(m => m.ModuleId === moduleId);
            if (localModule) localModule.ModuleName = newValue;
          },
          error: () => {
            this.toastr.error('Failed to update Module Name.', 'Error');
          }
        });
      },
      error: () => {
        this.toastr.error('Failed to fetch Module details.', 'Error');
      }
    });
  }

  onModuleDescriptionChange(moduleId: number, newValue: string) {
    if (!newValue.trim()) {
      this.toastr.warning('Module Description cannot be empty.', 'Validation Error');
      return;
    }
    this.moduleService.getModuleById(moduleId.toString()).subscribe({
      next: (module) => {
        const updatedModule = {
          ...module,
          ModuleDescription: newValue,
          CourseId: module.CourseId
        };
        this.moduleService.updateModule(moduleId.toString(), updatedModule).subscribe({
          next: () => {
            this.toastr.success('Module Description updated!', 'Success');
            const localModule = this.modules.find(m => m.ModuleId === moduleId);
            if (localModule) localModule.ModuleDescription = newValue;
          },
          error: () => {
            this.toastr.error('Failed to update Module Description.', 'Error');
          }
        });
      },
      error: () => {
        this.toastr.error('Failed to fetch Module details.', 'Error');
      }
    });
  }

  // --- Attachment/Video Modal Logic ---

  AttachmentPopup(moduleId: number, moduleName: string, courseName: string, courseId?: number): void {
    this.selectedAttachmentModuleId = moduleId;
    this.selectedAttachmentModuleName = moduleName.toString();
    this.selectedAttachmentCourseName = courseName;
    this.selectedAttachmentCourseId = courseId || null;
    this.getModuleVideos();

    const modalElement = document.getElementById('attachmentModal');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modalElement.addEventListener('hidden.bs.modal', () => {
        this.resetAttachmentModal();
      }, { once: true });
      modal.show();
    }
  }

  getModuleVideos(): void {
    if (!this.selectedAttachmentModuleId || !this.selectedAttachmentCourseId) {
      this.videoUrls = [];
      return;
    }
    this.moduleService.getModuleVideos(this.selectedAttachmentCourseId, this.selectedAttachmentModuleId).subscribe({
      next: (videos) => this.videoUrls = videos,
      error: () => this.videoUrls = []
    });
  }

  fetchArchiveOrgDuration() {
    if (!this.moduleVideoName || !this.newVideoUrl || !this.selectedAttachmentModuleId || !this.selectedAttachmentCourseId) return;
    this.isFetchingDuration = true;
    this.downloadProgress = 0;
    this.moduleService.getArchiveOrgDuration(this.newVideoUrl).subscribe({
      next: (event) => {
        if (
          event.type === HttpEventType.DownloadProgress &&
          typeof (event as any).partialText === 'string'
        ) {
          // Streaming text response, parse each line
          const lines = (event as any).partialText.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (typeof data.progress === 'number') {
                this.downloadProgress = Math.min(Math.max(data.progress, 0), 100);
              } else if (data.progress === 'indeterminate') {
                this.downloadProgress = -1;
              }
            } catch {}
          }
        } else if (event.type === HttpEventType.Response) {
          // Final response, parse duration
          try {
            const lines = event.body.split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;
              const data = JSON.parse(line);
              if (data.duration) {
                const videoData: ModuleVideoRequest = {
                  course_id: this.selectedAttachmentCourseId!,
                  module_id: this.selectedAttachmentModuleId!,
                  video_title: this.moduleVideoName,
                  video_url: this.newVideoUrl,
                  duration_in_seconds: data.duration, // Save as string (e.g., "06:38")
                  sequence_no: this.videoUrls.length + 1,
                  created_by: 'admin'
                };
                this.moduleService.insertModuleVideo(videoData).subscribe({
                  next: () => {
                    this.isFetchingDuration = false;
                    this.moduleVideoName = '';
                    this.newVideoUrl = '';
                    this.downloadProgress = 0;
                    this.getModuleVideos();
                  },
                  error: () => {
                    this.isFetchingDuration = false;
                    this.downloadProgress = 0;
                  }
                });
              }
            }
          } catch {
            this.isFetchingDuration = false;
            this.downloadProgress = 0;
          }
        }
      },
      error: () => {
        this.isFetchingDuration = false;
        this.downloadProgress = 0;
      }
    });
  }

  parseDuration(duration: string): number {
    // If it's a plain number string, just return it as seconds
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10);
    }
    // If it's in mm:ss format
    if (/^\d{2}:\d{2}$/.test(duration)) {
      const [minutes, seconds] = duration.split(':').map(Number);
      return minutes * 60 + seconds;
    }
    // ISO 8601 duration (e.g., PT1H2M3S)
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) return 0;
    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  deleteVideoUrl(index: number): void {
    const video = this.videoUrls[index];
    if (!video || !video.video_id) return;
    this.moduleService.deleteModuleVideo(video.video_id).subscribe({
      next: () => this.getModuleVideos(),
      error: () => {}
    });
  }

  resetAttachmentModal() {
    this.moduleVideoName = '';
    this.newVideoUrl = '';
    this.videoUrls = [];
    this.isFetchingDuration = false;
    this.selectedAttachmentModuleId = null;
    this.selectedAttachmentModuleName = null;
    this.selectedAttachmentCourseName = null;
    this.selectedAttachmentCourseId = null;
  }
}


