import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebsiteNavbarComponent } from './website-navbar.component';

describe('WebsiteNavbarComponent', () => {
  let component: WebsiteNavbarComponent;
  let fixture: ComponentFixture<WebsiteNavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebsiteNavbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebsiteNavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
