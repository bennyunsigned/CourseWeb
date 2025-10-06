import { Component } from '@angular/core';
import { WebsiteNavbarComponent } from "../website-navbar/website-navbar.component";
import { WebsiteCarouselComponent } from "../website-carousel/website-carousel.component";
import { WebsiteAboutusComponent } from "../website-aboutus/website-aboutus.component";
import { WebsiteContactusComponent } from "../website-contactus/website-contactus.component";
import { WebsiteTestimonialsComponent } from "../website-testimonials/website-testimonials.component";
import { WebsitePricingComponent } from "../website-pricing/website-pricing.component";
import { WesiteFooterComponent } from "../wesite-footer/wesite-footer.component";
import { AvailableCoursesComponent } from '../../admin-panel/courses/available-courses/available-courses.component';

@Component({
  selector: 'app-website-base',
  imports: [
    WebsiteNavbarComponent, 
    WebsiteCarouselComponent, 
    WebsiteAboutusComponent, 
    WebsiteContactusComponent, 
    WebsiteTestimonialsComponent, 
    WebsitePricingComponent, 
    WesiteFooterComponent,
    AvailableCoursesComponent
  ],
  templateUrl: './website-base.component.html',
  styleUrl: './website-base.component.css'
})
export class WebsiteBaseComponent {

}
