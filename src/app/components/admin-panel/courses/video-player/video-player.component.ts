import { Component, Input, OnChanges, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoPlayerComponent implements OnChanges {
  @Input() videoInput: string = '';
  videoSrc: string = '';
  isPlaying: boolean = false;

  @Output() playClicked = new EventEmitter<void>();

  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  ngOnChanges() {
    this.updateVideoSource();
  }

  private updateVideoSource() {
    this.videoSrc = this.videoInput || '';
    this.isPlaying = false; // Reset play state when video changes
  }


  onPlayClick() {
    this.playClicked.emit();
    this.isPlaying = true;
    setTimeout(() => {
      if (this.videoRef && this.videoRef.nativeElement) {
        this.videoRef.nativeElement.play();
      }
    });
  }

  pauseVideo() {
    this.isPlaying = false;
    setTimeout(() => {
      if (this.videoRef && this.videoRef.nativeElement) {
        this.videoRef.nativeElement.pause();
        this.videoRef.nativeElement.currentTime = 0;
      }
    });
  }
}
