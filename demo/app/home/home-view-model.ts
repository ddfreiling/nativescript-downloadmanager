import { Observable, fromObject } from '@nativescript/core'

import { DownloadManager, DownloadRequest, DownloadStatus, DownloadState } from '@nota/nativescript-downloadmanager';

export class HomeViewModel extends Observable {
  private state: string = '';
  private progress: number = 0;
  private spaceAvailable: number = 0;

  constructor() {
    super()
  }
}
