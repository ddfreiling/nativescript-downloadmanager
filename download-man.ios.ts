import * as fs from 'file-system';
import * as http from 'http';
import * as appSettings from 'application-settings';

import {Common} from './download-man.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './download-man.types';
export * from './download-man.types';

interface DownloadTask {
  refId: number;
  request: DownloadRequest;
  bytesTotal: number;
  progress: number;
  state: DownloadState;
  reason: string;
}

const DOWNLOADMANAGER_PERSISTANCE_KEY = 'TNS_NOTA_DOWNLOADMANAGER_IOS';

// TODO: Cannot add extraHeaders on iOS
// TODO: Cannot control whether downloads are allowed over metered connection. Wifi-only atm.
export class DownloadManager extends Common {

  private session: NSURLSession;
  private twr: TWRDownloadManager;
  private currentTasks: { [refId: number]: DownloadTask } = {};

  constructor() {
    super();
    this.twr = TWRDownloadManager.sharedManager();
    this.loadPersistedTasks();
    this.resumeTaskProgressTracking();
  }

  private persistCurrentTasks() {
    appSettings.setString(DOWNLOADMANAGER_PERSISTANCE_KEY, JSON.stringify(this.currentTasks));
  }

  private loadPersistedTasks() {
    this.currentTasks = JSON.parse(appSettings.getString(DOWNLOADMANAGER_PERSISTANCE_KEY, '{}'));
  }

  private updateTaskProgress(refId: number, progress: number, state: DownloadState) {
    const task = this.currentTasks[refId];
    if (task) {
      task.progress = progress;
      task.state = state;
    }
  }

  private resumeTaskProgressTracking() {
    const refIds: number[] = this.getDownloadsInProgress();
    console.log('== Current Download refIds, according to TWR: '+ JSON.stringify(refIds));
    for (const key of Object.keys(this.currentTasks)) {
      const refId: number = +key;
      const task: DownloadTask = this.currentTasks[refId];
      
      if (this.isInProgress(task.state) && refIds.some((refId) => task.refId === refId)) {
        // Restart tracking of download progress
        const isDownloading = this.twr.isFileDownloadingForUrlWithProgressBlockCompletionBlock(task.request.url, (progress) => {
          this.updateTaskProgress(refId, progress, DownloadState.RUNNING);
        }, (success) => {
          this.updateTaskProgress(refId, 1, success ? DownloadState.SUCCESFUL: DownloadState.FAILED);
        });
        if (!isDownloading) {
          console.log('TWRDownloadManager reports we are NOT downloading url: '+ task.request.url);
          delete this.currentTasks[refId];
        }
      } else {
        // Download no longer active or in a usable state, delete it.
        delete this.currentTasks[refId];
      }
    }
  }

  downloadFile(request: DownloadRequest): Promise<number> {
    const destPath = request.destinationLocalUri;
    const tempFolder: fs.Folder = fs.knownFolders.temp();
    const tempOffsetIndex = destPath.indexOf(tempFolder.path);
    if (tempOffsetIndex === -1) {
      return Promise.reject('Download destination cannot be outside temp/cache directory on iOS.');
    }
    if (fs.File.exists(request.destinationLocalUri)) {
      fs.File.fromPath(request.destinationLocalUri).removeSync((err) => {
        return Promise.reject(`Download destination already exists and could not remove existing file. ${err}`);
      });
    }
    const lastSlashIndex = request.destinationLocalUri.lastIndexOf('/');
    const directoryPath = request.destinationLocalUri.substr(0, lastSlashIndex);
    const destFilename = request.destinationLocalUri.substr(lastSlashIndex + 1);
    const relativeDirectoryPath = directoryPath.replace(tempFolder.path, '');

    if (!fs.Folder.exists(directoryPath)) {
      console.log('Folder does not exist!');
      // Implicitly creates folder when using Folder.fromPath
      fs.Folder.fromPath(directoryPath);
    }
    const refId: number = this.getNewRefId();
    console.log(`Submit download with refId=${refId}, url=${request.url} destFolder=${relativeDirectoryPath}, destFilename=${destFilename}`);
    return this.getUrlContentLength(request.url).then((contentLength) => {
      const task = {
        refId: refId,
        request: request,
        progress: 0,
        bytesTotal: contentLength,
        state: DownloadState.PENDING,
        reason: 'none',
      };
      this.twr.downloadFileForURLWithNameInDirectoryNamedProgressBlockCompletionBlockEnableBackgroundMode(
          request.url, destFilename, relativeDirectoryPath, (progress: number) => {
        // console.log(`Progress: refId=${refId} url=${request.url} percent=${Math.round(progress * 100)}%`);
        this.updateTaskProgress(refId, progress, DownloadState.RUNNING);
      }, (success: boolean) => {
        // console.log(`Download complete. refId=${refId} url=${request.url} success=${success}`);
        this.updateTaskProgress(refId, 1, success ? DownloadState.SUCCESFUL : DownloadState.FAILED);
      }, true);
      this.currentTasks[refId] = task;
      return refId;
    });
  }

  getNewRefId(): number {
    return Object.keys(this.currentTasks).reduce((prev, cur, index) => Math.max(prev, +cur), 0) + 1;
  }

  isDownloadInProgress(refId: number): boolean {
    const task = this.currentTasks[refId];
    return task && this.twr.isFileDownloadingForUrlWithProgressBlock(task.request.url, () => {});
  }

  getDownloadStatus(refId: number): DownloadStatus {
    const task = this.currentTasks[refId];
    if (task) {
      const status = {
        refId: task.refId,
        title: task.request.url,
        downloadUri: task.request.url,
        bytesDownloaded: Math.floor(task.bytesTotal * task.progress),
        bytesTotal: task.bytesTotal,
        localUri: task.request.destinationLocalUri,
        state: task.state,
        reason: task.reason
      };
      if (!this.isInProgress(status.state)) {
        // Download finished, remove it from current tasks
        delete this.currentTasks[task.refId];
      }
      return status;
    }
    return null;
  }

  getDownloadsInProgress(): number[] {
    return this.twr.currentDownloads().map((url) => this.getTaskByUrl(url).refId);
  }

  getExternalFilesDirPath(): string {
    // temp/cache directory is where large files are stored on iOS. These will NOT be synced to iCloud.
    // see https://developer.apple.com/icloud/documentation/data-storage/index.html
    return fs.knownFolders.temp().path;
  }

  getSizeOfFile(localFilePath: string): number {
    const dict = NSFileManager.defaultManager().attributesOfItemAtPathError(localFilePath);
    const fileSize = dict.valueForKey(NSFileSize);
    return fileSize ? fileSize.longValue : 0;
  }

  cancelDownloads(...refIds: number[]): void {
    const urls = refIds
      .map((refId) => this.currentTasks[refId])
      .filter((task) => task && this.isInProgress(task.state))
      .map((task) => task.request.url);
    for (const url of urls) {
      this.twr.cancelDownloadForUrl(url);
    }
  }

  cancelAllDownloads(): void {
    this.twr.cancelAllDownloads();
  }

  destroy(): void {
    this.persistCurrentTasks();
    this.twr.dealloc();
    this.twr = null;
    this.currentTasks = null;
  }

  private getUrlContentLength(url: string): Promise<number> {
    return http.request({
      method: 'HEAD',
      url: url
    }).then((res) => {
      if (!res.headers['Content-Length']) {
        return Promise.reject('Invalid Content-Length header');
      }
      return +res.headers['Content-Length'];
    });
  }

  private getTaskByUrl(url: string) {
    for (const key of Object.keys(this.currentTasks)) {
      if (this.currentTasks[key].request.url === url) {
        return this.currentTasks[key];
      }
    }
  }
}
