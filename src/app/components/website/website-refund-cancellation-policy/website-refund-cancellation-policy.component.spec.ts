import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebsiteRefundCancellationPolicyComponent } from './website-refund-cancellation-policy.component';

describe('WebsiteRefundCancellationPolicyComponent', () => {
  let component: WebsiteRefundCancellationPolicyComponent;
  let fixture: ComponentFixture<WebsiteRefundCancellationPolicyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebsiteRefundCancellationPolicyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebsiteRefundCancellationPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
