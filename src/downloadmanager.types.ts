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
  android: any;
  ios: any;
  debugOutputEnabled: boolean;

  constructor(debugOutputEnabled?: boolean);
  /**
   * Downloads a single file using a DownloadRequest
   * @return Promise<number> with reference ID to the started download
   */
  downloadFile(request: DownloadRequest): Promise<number>;
  /**
   * Checks if a download is currently in-progress using a reference ID
   */
  isDownloadInProgress(refId: number): boolean;
  /**
   * Checks if a given DownloadState is categorized as being in-progress
   */
  isInProgress(state: DownloadState): boolean;
  /**
   * Gets the reference IDs of all downloads in progress
   */
  getDownloadsInProgress(): number[];
  /**
   * Gets the DownloadState of a single download, for a given reference ID
   */
  getDownloadState(refId: number): DownloadState;
  /**
   * Gets a detailed DownloadStatus for a given reference ID
   */
  getDownloadStatus(refId: number): DownloadStatus;
  // pauseDownload(refId: number): any;
  // resumeDownload(resumeToken: any): boolean;
  /**
   * Cancels downloads based on one or more reference IDs
   */
  cancelDownloads(...refIds: number[]): void;
  /**
   * Cancels all active downloads
   */
  cancelAllDownloads(): void;
  /**
   * Gets the absolute and canonical dir path,
   * for storing files externally
   */
  getExternalFilesDirPath(): string;
  /**
   * Gets the absolute and canonical dir path,
   * for storing files inaccesible to the user
   */
  getPrivateFilesDirPath(): string;
  /**
   * Gets the available disk space in bytes on the native platform
   */
  getAvailableDiskSpaceInBytes(): number;
  /**
   * Gets the size of a local file in bytes
   */
  getSizeOfFile(localFilePath: string): number;
  iosSetBackgroundSessionCompletionHandler(sessionIdentifier: string, completionHandler: () => void): void;
  /**
   * Clean up any resources or subscriptions held
   */
  destroy(): void;
}