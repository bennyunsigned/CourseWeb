import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _loading$ = new BehaviorSubject<boolean>(false);

  get loading$(): Observable<boolean> {
    return this._loading$.asObservable();
  }

  show(): void {
    this._loading$.next(true);
  }

  hide(): void {
    this._loading$.next(false);
  }
}
