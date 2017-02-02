import * as fs from 'file-system';
import * as http from 'http';
import * as appSettings from 'application-settings';
import * as utils from 'utils/utils';

import {Common} from './download-man.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './download-man.types';
export * from './download-man.types';

export interface DownloadTaskIOS {
  refId: number;
  request: DownloadRequest;
  state: DownloadState;
  latestProgress: HWIFileDownloadProgress;
  reason: string;
  resumeData?: NSData;
}

const DOWNLOADMANAGER_PERSISTANCE_KEY = 'TNS_NOTA_DOWNLOADMANAGER_IOS';

export class HWIFileDownloadDelegateImpl extends NSObject implements HWIFileDownloadDelegate {
  
  public static ObjCProtocols = [ HWIFileDownloadDelegate ]
  private man: DownloadManager;
  private activityCount = 0;
  private _sessionConfig: NSURLSessionConfiguration;

  public init() {
    var self = super.init();
    return self;
  }
  
  public initWithDownloadManager(man: DownloadManager) {
    var self = super.init();
    this.man = man;
    return self;
  }

  get sessionConfig() {
    return this._sessionConfig;
  }

  /**
   * Required delegate functions
   */

	incrementNetworkActivityIndicatorActivityCount(): void {
    ++this.activityCount;
    this.updateNetworkActivityIndicatorVisibility();
  }

	decrementNetworkActivityIndicatorActivityCount(): void {
    --this.activityCount;
    this.updateNetworkActivityIndicatorVisibility();
  }

	downloadDidCompleteWithIdentifierLocalFileURL(aDownloadIdentifier: string, aLocalFileURL: NSURL): void {
    console.log(`HWI.downloadDidComplete: ${aDownloadIdentifier} -> ${aLocalFileURL.absoluteString}`);
    this.updateTaskProgress(aDownloadIdentifier, DownloadState.SUCCESFUL);
  }

	downloadFailedWithIdentifierErrorHttpStatusCodeErrorMessagesStackResumeData(aDownloadIdentifier: string, anError: NSError, aHttpStatusCode: number, anErrorMessagesStack: NSArray<string>, aResumeData: NSData): void {
    console.log(`HWI.downloadDidFail: refId=${aDownloadIdentifier}, statuscode=${aHttpStatusCode}, errorDesc=${anError.localizedDescription}`);
    this.updateTaskProgress(aDownloadIdentifier, DownloadState.FAILED, undefined, anError.localizedDescription, aResumeData);
  }

  /**
   * Optional delegate functions
   */
  
  customizeBackgroundSessionConfiguration?(aBackgroundSessionConfiguration: NSURLSessionConfiguration): void {
    console.log(`HWI: customizeBackgroundSessionConfiguration`);
    this._sessionConfig = aBackgroundSessionConfiguration;
    // Can set additional headers or disallow cellular data usage here
    // see https://developer.apple.com/reference/foundation/nsurlsessionconfiguration
  }

	downloadPausedWithIdentifierResumeData?(aDownloadIdentifier: string, aResumeData: NSData): void {
    console.log(`HWI: downloadDidPause: ${aDownloadIdentifier}`);
    this.updateTaskProgress(aDownloadIdentifier, DownloadState.PAUSED, undefined, undefined, aResumeData);
  }

	downloadProgressChangedForIdentifier?(aDownloadIdentifier: string): void {
    const progress: HWIFileDownloadProgress = this.man.hwi.downloadProgressForIdentifier(aDownloadIdentifier);
    this.updateTaskProgress(aDownloadIdentifier, DownloadState.RUNNING, progress);
  }

  localFileURLForIdentifierRemoteURL?(aDownloadIdentifier: string, aRemoteURL: NSURL): NSURL {
    console.log(`HWI.localFileURLForIdentifierRemoteURL: refId=${aDownloadIdentifier}, url=${aRemoteURL.path}`);
    const task = this.man.getTaskByRefId(aDownloadIdentifier);
    if (task) {
      const destPath = task.request.destinationLocalUri;
      console.log(`Downloaded file destination path: ${destPath}`);
      try {
        const destFolderPath = destPath.substr(0, destPath.lastIndexOf('/'))
        if (!fs.Folder.exists(destFolderPath)) {
          console.log(`Creating folders for path: ${destFolderPath}`);
          // Implicitly ensuring folder is created when using Folder.fromPath
          
          fs.Folder.fromPath(destFolderPath);
        }
      } catch (err) {
        console.log(`ERROR creating folder: ${err}`);
      }
      const cacheRelativePath = task.request.destinationLocalUri.replace(fs.knownFolders.temp().path, '');
      console.log(`Saving to path relative to cache/temp folder: ${cacheRelativePath}`);

      const paths = NSSearchPathForDirectoriesInDomains(NSSearchPathDirectory.CachesDirectory, NSSearchPathDomainMask.UserDomainMask, true);
      const cacheDir = paths.objectAtIndex(0);
      return NSURL.fileURLWithPathIsDirectory(cacheDir, true).URLByAppendingPathComponent(cacheRelativePath);
    } else {
      console.log(`Error: no task matching refId=${aDownloadIdentifier}, cannot provide any localFileURL to save it to`);
    }
  }

  resumeDownloadWithIdentifier?(aDownloadIdentifier: string): void {
    console.log(`HWI.resumeDownloadWithIdentifier: refId=${aDownloadIdentifier}`);
  }
	// downloadAtLocalFileURLIsValidForDownloadIdentifier?(aLocalFileURL: NSURL, aDownloadIdentifier: string): boolean;
	// httpStatusCodeIsValidForDownloadIdentifier?(aHttpStatusCode: number, aDownloadIdentifier: string): boolean;
	// onAuthenticationChallengeDownloadIdentifierCompletionHandler?(aChallenge: NSURLAuthenticationChallenge, aDownloadIdentifier: string, aCompletionHandler: (p1: NSURLCredential, p2: NSURLSessionAuthChallengeDisposition) => void): void;
	// rootProgress?(): NSProgress;
	// urlRequestForRemoteURL?(aRemoteURL: NSURL): NSURLRequest;

  private updateTaskProgress(refId: string, state: DownloadState, progress?: HWIFileDownloadProgress, reason?: string, resumeData?: NSData) {
    const task = this.man.getTaskByRefId(refId);
    if (task) {
      task.state = state;
      if (progress) {
        task.latestProgress = progress;
      }
      if (reason) {
        task.reason = reason;
      }
      if (resumeData) {
        task.resumeData = resumeData;
      }
    }
  }

  private updateNetworkActivityIndicatorVisibility() {
    const sharedApp = utils.ios.getter(UIApplication, UIApplication.sharedApplication);
    sharedApp.networkActivityIndicatorVisible = (this.activityCount > 0)
  }
}

export class DownloadManager extends Common {

  public hwi: HWIFileDownloader;
  private delegate: HWIFileDownloadDelegateImpl;
  private currentTasks: { [refId: number]: DownloadTaskIOS } = {};

  constructor() {
    super();
    console.log(`DownloadManager.new`);
    this.delegate = (<HWIFileDownloadDelegateImpl>HWIFileDownloadDelegateImpl.alloc()).initWithDownloadManager(this);
    this.hwi = HWIFileDownloader.alloc().initWithDelegateMaxConcurrentDownloads(this.delegate, 1);
    this.hwi.setupWithCompletion(() => {
      console.log(`DownloadManager - HWI setup completed!`);
    });
    this.loadPersistedTasks();
    this.resumeTasks();
  }

  private persistCurrentTasks() {
    appSettings.setString(DOWNLOADMANAGER_PERSISTANCE_KEY, JSON.stringify(this.currentTasks));
  }

  private loadPersistedTasks() {
    this.currentTasks = JSON.parse(appSettings.getString(DOWNLOADMANAGER_PERSISTANCE_KEY, '{}'));
  }

  // Used by HWI delegate
  getTaskByRefId(refId: string): DownloadTaskIOS {
    return this.currentTasks[refId];
  }
  // END Used by HWI delegate

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
    if (this.delegate.sessionConfig) {
      this.delegate.sessionConfig.allowsCellularAccess = request.allowedOverMetered;
    }

    const refId: number = this.getNextRefId();
    console.log(`\n\nSubmit download with refId=${refId}, url=${request.url} destination=${request.destinationLocalUri}\n\n`);
    const task = {
      refId: refId,
      request: request,
      latestProgress: null,
      state: DownloadState.PENDING,
      reason: 'none',
    };
    this.hwi.startDownloadWithIdentifierFromRemoteURL(''+ refId, NSURL.URLWithString(request.url));
    
    this.currentTasks[refId] = task;
    this.persistCurrentTasks();
    return Promise.resolve(refId);
  }

  getNextRefId(): number {
    return Object.keys(this.currentTasks).reduce((prev, cur, index) => Math.max(prev, +cur), 0) + 1;
  }

  isDownloadInProgress(refId: number): boolean {
    const task = this.currentTasks[refId];
    try {
      return task && this.hwi.isDownloadingIdentifier(task.request.url);
    } catch (err) {
      console.log(`DownloadManager.isDownloadInProgress - Error: ${err}`);
      return false;
    }
  }

  getDownloadStatus(refId: number): DownloadStatus {
    const task = this.currentTasks[refId];
    if (task) {
      const status = {
        refId: task.refId,
        title: task.request.url,
        downloadUri: task.request.url,
        bytesDownloaded: task.latestProgress ? task.latestProgress.receivedFileSize : 0,
        bytesTotal: task.latestProgress ? task.latestProgress.expectedFileSize : 0,
        localUri: task.request.destinationLocalUri,
        state: task.state,
        reason: task.reason
      };
      return status;
    }
    return null;
  }

  getDownloadsInProgress(): number[] {
    const refIdsInProgress: number[] = [];
    for (const refId in this.currentTasks) {
      if (this.hwi.isDownloadingIdentifier(refId)) {
        refIdsInProgress.push(+refId);
      }
    }
    return refIdsInProgress;
  }

  getExternalFilesDirPath(): string {
    // temp/cache directory is where large files are stored on iOS. These will NOT be synced to iCloud.
    // see https://developer.apple.com/icloud/documentation/data-storage/index.html
    // TODO: Should we set ExcludedFromBackup flag?
    // see https://developer.apple.com/library/ios/qa/qa1719/_index.html
    return fs.knownFolders.temp().path;
  }

  getSizeOfFile(localFilePath: string): number {
    const nsFileManager = utils.ios.getter(NSFileManager, NSFileManager.defaultManager);
    const dict = nsFileManager.attributesOfItemAtPathError(localFilePath);
    const fileSize = dict.valueForKey(NSFileSize);
    return fileSize ? fileSize.longValue : 0;
  }

  cancelDownloads(...refIds: number[]): void {
    for (const refId of refIds) {
      try {
        this.hwi.cancelDownloadWithIdentifier(''+ refId);
        delete this.currentTasks[refId];
      } catch (err) {
        console.log(`DownloadManager.cancelDownloads - Error: ${err}`);
      }
    }
    this.persistCurrentTasks();
  }

  cancelAllDownloads(): void {
    for (const refId in this.currentTasks) {
      try {
        this.hwi.cancelDownloadWithIdentifier(refId);
        delete this.currentTasks[refId];
      } catch (err) {
        console.log(`DownloadManager.cancelAllDownloads - Error: ${err}`);
      }
    }
    this.persistCurrentTasks();
  }

  getAvailableDiskSpaceInBytes(): number {
    const fileMan: NSFileManager = utils.ios.getter(NSFileManager, NSFileManager.defaultManager);
    const paths = NSSearchPathForDirectoriesInDomains(NSSearchPathDirectory.DocumentDirectory, NSSearchPathDomainMask.UserDomainMask, true);
    const fileSystemAttDict = fileMan.attributesOfFileSystemForPathError(paths.lastObject);
    return fileSystemAttDict.objectForKey(NSFileSystemFreeSize);
  }

  destroy(): void {
    this.persistCurrentTasks();
    this.hwi.dealloc();
    this.hwi = null;
    this.delegate.dealloc();
    this.delegate = null;
    this.currentTasks = null;
  }

  private resumeTasks() {
    for (const key in this.currentTasks) {
      const refId: number = +key;
      const task: DownloadTaskIOS = this.currentTasks[refId];
      
      if (!this.isInProgress(task.state)) {
        console.log(`DownloadMan: cleaning task no longer in-progress, for refId=${refId}, url=${task.request.url}`);
        delete this.currentTasks[refId];
      } else if (task.resumeData) {
        console.log(`DownloadMan: resume task with refId=${refId}, url=${task.request.url}`);
        this.hwi.startDownloadWithIdentifierUsingResumeData(key, task.resumeData);
      }
    }
  }
}
