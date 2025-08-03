import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseContentDetailsComponent } from './course-content-details.component';

describe('CourseContentDetailsComponent', () => {
  let component: CourseContentDetailsComponent;
  let fixture: ComponentFixture<CourseContentDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseContentDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseContentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
