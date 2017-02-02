import * as fs from 'file-system';
import * as app from 'application';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs'

import { DownloadManager, DownloadRequest, DownloadStatus, DownloadState } from '@nota/nativescript-downloadmanager';
import { DownloadJobManager, DownloadJob, DownloadJobStatus } from './download-job-manager';

const BookStorageFolderName = 'books';
const BookContentFolderName = 'content';
const BookMetadataFileName = 'metadata.json';
const MagicFullyDownloadedFileName = 'fully_downloaded';

// mocked list of URIs from book contentlist
const testContentList = [
  { url: 'http://ipv4.download.thinkbroadband.com/10MB.zip', localUri: '10MB.zip' },
  { url: 'http://ipv4.download.thinkbroadband.com/20MB.zip', localUri: '20MB.zip' },
  { url: 'http://ipv4.download.thinkbroadband.com/50MB.zip', localUri: '50MB.zip' },
  { url: 'http://ipv4.download.thinkbroadband.com/100MB.zip', localUri: 'some/deep/folder/4.zip' },
  // { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '5.mp3' },
  // { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '6.mp3' },
  // { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '7.mp3' },
  // { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '8.mp3' },
  // { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '9.mp3' },
];


export class PersistanceModule {

  private _jobManager: DownloadJobManager;

  private get jobManager(): DownloadJobManager {
    if (!this._jobManager) {
      this._jobManager = new DownloadJobManager();
    }
    return this._jobManager;
  }

  /* DEBUG */
  
  debugPrintStorageFolder() {
    const bookFolder = this.getBookStorageFolder();
    console.log('Folder: '+ bookFolder.path);
    traceFolderTree(bookFolder);
  }
  
  getBookFolder(bookId: string) {
    return this.getBookFolderPath(bookId);
  }

  getBookFolderPath(bookId: string): string {
    return fs.path.join(this.getBookStorageFolder().path, bookId);
  }

  getBookLocalUriPath(bookId: string, localUri: string) {
    return fs.path.join(this.getBookFolderPath(bookId), BookContentFolderName, localUri);
  }

  /* BOOK DOWNLOAD */

  isDownloadingBook(bookId: string): boolean {
    return this.jobManager.hasRunningJob(bookId);
  }

  stopAllBookDownloads() {
    this.jobManager.deleteAllJobs();
  }
  
  deleteBookContents(bookId: string): Promise<any> {
    console.log('delete book contents: '+ bookId);
    this.jobManager.deleteJob(bookId);
    const contentPath = fs.path.join(this.getBookFolderPath(bookId), BookContentFolderName);
    return fs.Folder.fromPath(contentPath).remove().then(() => {
      console.log('set fully downloaded = false');
      return this.setBookFullyDownloaded(bookId, false).then(() => {
        console.log('set fully done');
        return true;
      });
    });
  }

  startDownloadingBook(bookId: string): Observable<DownloadJobStatus> {
    console.log(`---> start new downloadjob for bookId ${bookId}`);
    const downloadJob: DownloadJob = new DownloadJob(bookId, testContentList.map((src) => {
      console.log(`\nDownload url: ${src.url}`);
      const req = new DownloadRequest(src.url, this.getBookLocalUriPath(bookId, src.localUri));
      //req.setNotification('Harry Potter: Fangen fra Azkaban', 'LYT3');
      req.allowedOverMetered = true;
      return req;
    }));
    this.jobManager.submitJob(downloadJob);
    return this.jobManager.getJobStatus(bookId).do(null, null, () => {
      this.setBookFullyDownloaded(bookId, true);
    });
  }
  
  resumeDownloadingBook(bookId: string): Observable<DownloadJobStatus> {
    console.log(`---> resume downloadjob for bookId ${bookId}`);
    return this.jobManager.getJobStatus(bookId).do(null, null, () => {
      this.setBookFullyDownloaded(bookId, true);
    });
  }
  
  hasFullyDownloadedBook(bookId: string) {
    return fs.File.exists(fs.path.join(this.getBookFolderPath(bookId), MagicFullyDownloadedFileName));
  }

  /* METADATA */
  
  hasBookMetadata(bookId: string): boolean {
    return fs.File.exists(fs.path.join(this.getBookFolderPath(bookId), BookMetadataFileName));
  }
  
  loadBookMetadata(bookId: string): Promise<any> {
    if (!this.hasBookMetadata(bookId)) {
      return Promise.reject('Cannot load metadata. File does not exist');
    } else {
      const metaPath = fs.path.join(this.getBookFolderPath(bookId), BookMetadataFileName);
      const metaFile = fs.File.fromPath(metaPath);
      return fs.File.fromPath(metaPath).readText().then((text) => JSON.parse(text));
    }
  }
  
  storeBookMetadata(bookId: string, bookMetadata: any): Promise<any> {
    const metaPath = fs.path.join(this.getBookFolderPath(bookId), BookMetadataFileName);
    const metaFile = fs.File.fromPath(metaPath);
    return metaFile.writeText(JSON.stringify(bookMetadata));
  }

  downloadFile(req: DownloadRequest): Promise<number> {
    return this.jobManager.downloadFile(req);
  }

  getExternalFilesDirPath() {
    return this.jobManager.getExternalFilesDirPath();
  }

  getDownloadStatus(refId: number) {
    return this.jobManager.getDownloadStatus(refId);
  }

  isInProgress(state: DownloadState) {
    return this.jobManager.isInProgress(state);
  }

  getAvailableDiskSpaceInBytes() {
    return this.jobManager.getAvailableDiskSpaceInBytes();
  }
  
  destroy() {
    this.jobManager.destroy();
  }

  private getBookStorageFolder(): fs.Folder {
    return fs.Folder.fromPath(fs.path.join(this.jobManager.getExternalFilesDirPath(), 'books'));
  }

  private setBookFullyDownloaded(bookId: string, fullyDownloaded: boolean): Promise<any> {
    const magicFilePath = fs.path.join(this.getBookFolderPath(bookId), MagicFullyDownloadedFileName);
    if (fullyDownloaded) {
      return fs.File.fromPath(magicFilePath).writeText("").then(() => {
        console.log(`WROTE MAGIC FILE for bookId=${bookId}`);
      });
    } else {
      return fs.File.fromPath(magicFilePath).remove().then(() => {
        console.log(`REMOVED MAGIC FILE for bookId=${bookId}`);
      });
    }
  }
}



/* HELPERS */


function traceFolderTree(folder: fs.Folder, maxDepth: number = 5, depth: number = 0) {
  let whitespace = new Array(depth + 1).join('  ');
  console.log(`${whitespace}${folder.name}`);
  folder.eachEntity((ent) => {
    try {
      if (fs.Folder.exists(ent.path) && depth < maxDepth) {
        traceFolderTree(fs.Folder.fromPath(ent.path), maxDepth, depth + 1);
      } else {
        console.log(`${whitespace}- ${ent.name}`);
      }
    } catch (err) {
    }
    return true;
  });
}