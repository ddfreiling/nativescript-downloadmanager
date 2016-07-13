import * as fs from 'file-system';
import * as http from 'http';
import { Observable } from 'rxjs/Observable';

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

// TODO: Cannot add extraHeaders on iOS
// TODO: Cannot control whether downloads are allowed over metered connection. Wifi-only atm.
// TODO: Download tasks do not persist after app termination on iOS.
//       Killing the app effectively kills the current download.
export class DownloadManager extends Common {

  private session: NSURLSession;
  private twr: TWRDownloadManager;
  private currentTasks: { [refId: string]: DownloadTask } = {};

  constructor() {
    super();
    this.twr = TWRDownloadManager.sharedManager();
  }

  private getFilePathParts(filePath): any {
    const lastSlashIndex = filePath.lastIndexOf('/');
    const directory = filePath.substr(0, lastSlashIndex);
    const filename = filePath.substr(lastSlashIndex + 1);
    console.log('dir: '+ directory);
    console.log('filename: '+ filename);
    return { directory, filename };
  }

  downloadFile(request: DownloadRequest): Promise<number> {
    const destPath = request.destinationLocalUri;
    const tempFolder: fs.Folder = fs.knownFolders.temp();
    const tempOffsetIndex = destPath.indexOf(tempFolder.path);
    if (tempOffsetIndex == -1) {
      return Promise.reject('Download destination cannot be outside temp/cache directory on iOS');
    }
    if (fs.File.exists(request.destinationLocalUri)) {
      return Promise.reject('Download destination already exists');
    }
    const lastSlashIndex = request.destinationLocalUri.lastIndexOf('/');
    const directoryPath = request.destinationLocalUri.substr(0, lastSlashIndex);
    const destFilename = request.destinationLocalUri.substr(lastSlashIndex + 1);
    const relativeDirectoryPath = directoryPath.replace(tempFolder.path, '');
    
    if (!fs.Folder.exists(directoryPath)) {
      console.log('Folder does not exist!');
      // Implicitly creates folder when using .fromPath
      fs.Folder.fromPath(directoryPath);
    }
    const refId = this.getNewRefId();
    console.log(`Submit download with refId=${refId}, url=${request.url} destFolder=${relativeDirectoryPath}, destFilename=${destFilename}`);
    return this.getUrlContentLength(request.url).then((contentLength) => {
      console.log('Got content-length: '+ contentLength);
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
        //console.log(`Progress: refId=${refId} url=${request.url} percent=${Math.round(progress * 100)}%`);
        task.progress = progress;
      }, (success: boolean) => {
        //console.log(`Download complete. refId=${refId} url=${request.url} success=${success}`);
        if (success) {
          task.progress = 1;
        }
        task.state = success ? DownloadState.SUCCESFUL : DownloadState.FAILED;
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
    if (task) {
      return this.twr.isFileDownloadingForUrlWithProgressBlock(task.request.url, () => {});
    }
  }

  getDownloadStatus(refId: number): DownloadStatus {
    const task = this.currentTasks[refId];
    if (task) {
      return {
        refId: task.refId,
        title: task.request.url,
        downloadUri: task.request.url,
        bytesDownloaded: Math.floor(task.bytesTotal * task.progress),
        bytesTotal: task.bytesTotal,
        localUri: task.request.destinationLocalUri,
        state: task.state,
        reason: task.reason
      }
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
