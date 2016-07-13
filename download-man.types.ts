export class DownloadRequest {
  url: string;
  destinationLocalUri: string;
  extraHeaders: { [key: string]: string } = {};
  allowedOverMetered: boolean = false;
  showNotification: boolean = false;
  notificationTitle: string;
  notificationDescription: string;

  constructor(url: string, destinationLocalUri: string) {
    this.url = url;
    this.destinationLocalUri = destinationLocalUri;
  }

  setNotification(title: string, description: string): void {
    this.showNotification = true;
    this.notificationTitle = title;
    this.notificationDescription = description;
  }

  addHeader(name: string, value: string): void {
    this.extraHeaders[name] = value;
  }
}

export enum DownloadState {
  PENDING = 1,
  RUNNING = 2,
  PAUSED = 4,
  SUCCESFUL = 8,
  FAILED = 16,
}

export interface DownloadStatus {
  refId: number;
  title: string;
  downloadUri: string;
  localUri: string;
  bytesDownloaded: number;
  bytesTotal: number;
  state: number;
  reason: string;
}

export declare class DownloadManager {
  downloadFile(request: DownloadRequest): Promise<number>;
  isDownloadInProgress(refId: number): boolean;
  isInProgress(state: DownloadState): boolean;
  getDownloadsInProgress(): number[];
  getDownloadState(refId: number): DownloadState;
  getDownloadStatus(refId: number): DownloadStatus;
  cancelDownloads(...refIds: number[]): void;
  cancelAllDownloads(): void;
  getExternalFilesDirPath(): string;
  destroy(): void;
}