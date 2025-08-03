export interface PublicCourseContentVideo {
  VideoId: number;
  VideoTitle: string;
  VideoUrl: string;
  DurationInSeconds: number;
  VideoSequenceNo: number;
}

export interface PublicCourseContentModule {
  ModuleId: number;
  ModuleName: string;
  ModuleDescription: string;
  ModuleSequenceNo: number;
  TotalDurationPerModule: number;
  Videos: PublicCourseContentVideo[];
}

export interface PublicCourseContent {
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
  Modules: PublicCourseContentModule[];
}
