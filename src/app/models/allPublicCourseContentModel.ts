export interface Video {
  VideoId: number;
  VideoTitle: string;
  VideoUrl: string;
  DurationInSeconds: number;
  VideoSequenceNo: number;
}

export interface Module {
  ModuleId: number;
  ModuleName: string;
  ModuleDescription: string;
  ModuleSequenceNo: number;
  TotalDurationPerModule: number;
  Videos: Video[];
}

export interface AllCourseContent {
  CourseId: number;
  CourseName: string;
  CourseDescription: string;
  CourseInfo: string;
  CourseLanguage: string;
  BannerImage: string;
  Author: string;
  Rating: number;
  ActualPrice: number;
  DiscountedPrice: number;
  IsPremium: number;
  IsBestSeller: number;
  VideoPath: string;
  IsPublic: number;
  TotalDurationPerCourse: number;
  Modules: Module[];
}