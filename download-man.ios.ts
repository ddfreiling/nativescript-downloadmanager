import { Observable } from 'rxjs/Observable';

import {Common} from './download-man.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './download-man.types';
export * from './download-man.types';

export class DownloadManager extends Common {
  downloadFile(request: DownloadRequest): number { return -1; }
  isDownloadInProgress(refId: number): boolean { return false; }
  getDownloadStatus(refId: number): DownloadStatus { return null; }
  getDownloadsInProgress() { return []; }
  getExternalFilesDirPath() { return ''; }
  cancelDownloads(...refIds: number[]): void {}
  cancelAllDownloads(): void {}
  destroy(): void {}
}