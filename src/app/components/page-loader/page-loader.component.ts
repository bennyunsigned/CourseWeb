import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-page-loader',
  imports: [CommonModule],
  templateUrl: './page-loader.component.html',
  styleUrls: ['./page-loader.component.css']
})
export class PageLoaderComponent implements OnInit, OnDestroy {
  isLoading: boolean = false;
  private sub?: Subscription;

  // Customizable text shown in the loader
  @Input() message: string = 'Loading...';
  @Input() subtitle?: string = '';
  // Either provide a logo URL or a short logo text (initials)
  @Input() logoUrl?: string;
  @Input() logoText: string = 'Z';

    constructor(private loadingService: LoadingService) {}

    ngOnInit(): void {
      this.sub = this.loadingService.loading$.subscribe(v => this.isLoading = v);
    }

    ngOnDestroy(): void {
      this.sub?.unsubscribe();
    }

    // Allow external callers (for example AppComponent) to show/hide loader
    public showLoader(): void {
      this.isLoading = true;
      this.loadingService.show();
    }

    public hideLoader(): void {
      this.isLoading = false;
      this.loadingService.hide();
    }
}
