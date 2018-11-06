import * as fs from 'tns-core-modules/file-system';
import * as http from 'tns-core-modules/http';
import * as appSettings from 'tns-core-modules/application-settings';
import * as utils from 'tns-core-modules/utils/utils';

import { Common } from './downloadmanager.common';
import { DownloadRequest, DownloadState, DownloadStatus } from './downloadmanager.types';
export * from './downloadmanager.types';

export class DownloadTaskIOS {
  refId: number;
  request: DownloadRequest;
  state: DownloadState;
  latestProgress: HWIFileDownloadProgress;
  reason: string;
  downloadStartTimestamp: number;
}

const DOWNLOADMANAGER_PERSISTANCE_KEY = 'TNS_NOTA_DOWNLOADMANAGER_IOS';
const FINISHED_TASK_RETENTION_MS = 1000 * 60 * 60 * 24 * 7; // 1 week
const NETWORK_ACTIVITY_TIMEOUT_MS = 5000;
const DEFAULT_REQUEST_IDLE_TIMEOUT = 60;

export class HWIFileDownloadDelegateImpl extends NSObject implements HWIFileDownloadDelegate {

  public static ObjCProtocols = [ HWIFileDownloadDelegate ];

  private static NETWORK_ACTIVITY_END_DELAY = 5000;
  private man: WeakRef<DownloadManager>;
  private isShowingNetworkActivity = false;

  public static alloc(): HWIFileDownloadDelegateImpl {
    return <HWIFileDownloadDelegateImpl>super.alloc();
  }

  public initWithDownloadManager(man: DownloadManager): HWIFileDownloadDelegateImpl {
    let self = super.init();
    this.man = new WeakRef(man);
    return self;
  }

  /**
   * Required delegate functions
   */

  public incrementNetworkActivityIndicatorActivityCount(): void {
  }

  public decrementNetworkActivityIndicatorActivityCount(): void {
  }

  public downloadDidCompleteWithIdentifierLocalFileURL(aDownloadIdentifier: string, aLocalFileURL: NSURL): void {
    this._log(`HWI.downloadDidComplete: ${aDownloadIdentifier} -> ${aLocalFileURL.absoluteString}`);
    const man = this.man.get();
    if (man) {
      man.updateTaskState(aDownloadIdentifier, DownloadState.SUCCESFUL);
      if (man.getDownloadsInProgress().length === 0) {
        this.setNetworkActivityIndicatorVisible(false);
      }
    }
  }

  public downloadFailedWithIdentifierErrorHttpStatusCodeErrorMessagesStackResumeData(aDownloadIdentifier: string, anError: NSError, aHttpStatusCode: number, anErrorMessagesStack: NSArray<string>, aResumeData: NSData): void {
    this._log(`HWI.downloadDidFail: refId=${aDownloadIdentifier}, statuscode=${aHttpStatusCode}, errorDesc=${anError.localizedDescription}`);
    const man = this.man.get();
    if (man) {
      man.updateTaskState(aDownloadIdentifier, DownloadState.FAILED, anError.localizedDescription);
      if (man.getDownloadsInProgress().length === 0) {
        this.setNetworkActivityIndicatorVisible(false);
      }
    }
  }

  /**
   * Optional delegate functions
   */

  public customizeBackgroundSessionConfiguration?(aBackgroundSessionConfiguration: NSURLSessionConfiguration): void {
    this._log(`HWI.customizeBackgroundSessionConfiguration`);
    // Session configuration can only be done here, as it is copied into NSURLSession post costumization.
    // see https://developer.apple.com/reference/foundation/nsurlsessionconfiguration
    // We default to allowing cellular access, as it can then be disallowed on a per-request basis in 'urlRequestForRemoteURL'.
    aBackgroundSessionConfiguration.allowsCellularAccess = true;
    if (this.man.get()) {
      this.man.get().setSessionIdentifier(aBackgroundSessionConfiguration.identifier);
    }
  }

  public downloadPausedWithIdentifierResumeData?(aDownloadIdentifier: string, aResumeData: NSData): void {
    this._log(`HWI: downloadDidPause: ${aDownloadIdentifier}, resumeData: ${aResumeData}`);
    const man = this.man.get();
    if (man) {
      man.updateTaskState(aDownloadIdentifier, DownloadState.PAUSED);
    }
  }

  private networkActivityTimeout: number;

  public downloadProgressChangedForIdentifier?(aDownloadIdentifier: string): void {
    const man = this.man.get();
    if (man) {
      man.updateTaskProgress(aDownloadIdentifier);
    }
    this.tempShowNetworkActivityIndicator();
  }

  public localFileURLForIdentifierRemoteURL?(aDownloadIdentifier: string, aRemoteURL: NSURL): NSURL {
    this._log(`HWI.localFileURLForIdentifierRemoteURL refId=${aDownloadIdentifier}, url=${aRemoteURL.absoluteString}`);
    const destPath = this.getDestinationLocalURI(aDownloadIdentifier);
    if (destPath) {
      this._log(`Downloaded file destination path: ${destPath}`);
      try {
        const destFolderPath = destPath.substr(0, destPath.lastIndexOf('/'));
        if (!fs.Folder.exists(destFolderPath)) {
          this._log(`Creating folders for path: ${destFolderPath}`);
          // Implicitly ensuring folder is created when using Folder.fromPath
          fs.Folder.fromPath(destFolderPath);
        }
      } catch (err) {
        this._log(`ERROR creating folder: ${err}`);
      }
      const cacheRelativePath = destPath.replace(fs.knownFolders.temp().path, '');
      this._log(`Saving to path relative to cache/temp folder: ${cacheRelativePath}`);

      const paths = NSSearchPathForDirectoriesInDomains(NSSearchPathDirectory.CachesDirectory, NSSearchPathDomainMask.UserDomainMask, true);
      const cacheDir = paths.objectAtIndex(0);
      return NSURL.fileURLWithPathIsDirectory(cacheDir, true).URLByAppendingPathComponent(cacheRelativePath);
    } else {
      this._log(`Error: no task matching refId=${aDownloadIdentifier}, cannot provide localFileURL to save it to`);
    }
    return null;
  }

  public resumeDownloadWithIdentifier?(aDownloadIdentifier: string): void {
    this._log(`HWI.resumeDownloadWithIdentifier refId=${aDownloadIdentifier}`);
  }

  public onAuthenticationChallengeDownloadIdentifierCompletionHandler?(aChallenge: NSURLAuthenticationChallenge, aDownloadIdentifier: string, aCompletionHandler: (p1: NSURLCredential, p2: NSURLSessionAuthChallengeDisposition) => void): void {
    this._log(`HWI.onAuthenticationChallenge refId=${aDownloadIdentifier}`);
    aCompletionHandler(null, NSURLSessionAuthChallengeDisposition.PerformDefaultHandling);
  }

  public urlRequestForRemoteURL?(aRemoteURL: NSURL): NSURLRequest {
    this._log(`HWI.urlRequestForRemoteURL URL=${aRemoteURL.absoluteString}`);
    const urlReq = NSMutableURLRequest.requestWithURL(aRemoteURL);
    const task = this.man.get() ? this.man.get().getTaskByURL(aRemoteURL.absoluteString) : null;
    if (task) {
      urlReq.allowsCellularAccess = task.request.allowedOverMetered;
      urlReq.timeoutInterval = task.request.iosOptions ?
        task.request.iosOptions.timeout : DEFAULT_REQUEST_IDLE_TIMEOUT;
      this._log(`HWI.urlRequestForRemoteURL timeout=${urlReq.timeoutInterval} ` +
                `allowsCellularAccess=${urlReq.allowsCellularAccess}`);
      if (task.request.extraHeaders) {
        for (const headerKey in task.request.extraHeaders) {
          urlReq.addValueForHTTPHeaderField(task.request.extraHeaders[headerKey], headerKey);
        }
      }
    }
    return urlReq;
  }
  // downloadAtLocalFileURLIsValidForDownloadIdentifier?(aLocalFileURL: NSURL, aDownloadIdentifier: string): boolean;
  // httpStatusCodeIsValidForDownloadIdentifier?(aHttpStatusCode: number, aDownloadIdentifier: string): boolean;
  // rootProgress?(): NSProgress;

  /**
   * Helpers
   */

  private getDestinationLocalURI(refId: string): string {
    const man = this.man.get();
    if (!man) {
      return null;
    }
    const task = man.getTaskByRefId(refId);
    return task ? task.request.destinationLocalUri : null;
  }

  private tempShowNetworkActivityIndicator() {
    if (this.isShowingNetworkActivity) {
      if (this.networkActivityTimeout) {
        clearTimeout(this.networkActivityTimeout);
      }
      this.networkActivityTimeout = setTimeout(() => {
        this.setNetworkActivityIndicatorVisible(false);
      }, NETWORK_ACTIVITY_TIMEOUT_MS);
    } else {
      this.setNetworkActivityIndicatorVisible(true);
    }
  }

  private setNetworkActivityIndicatorVisible(visible: boolean) {
    this._log(`setNetworkActivityIndicatorVisible = ${visible}`);
    this.isShowingNetworkActivity = visible;
    const sharedApp = utils.ios.getter(UIApplication, UIApplication.sharedApplication);
    sharedApp.networkActivityIndicatorVisible = visible;
  }

  private _log(logStr: string) {
    if (this.man.get()) {
      this.man.get()._log(logStr);
    }
  }
}

export class DownloadManager extends Common {

  public hwi: HWIFileDownloader;
  private delegate: HWIFileDownloadDelegateImpl;
  private currentTasks: { [refId: number]: DownloadTaskIOS } = {};
  private isReady = false;
  private isReadyPromise: Promise<void>;
  private sessionIdentifier: string;

  constructor(debugOutputEnabled = false) {
    super(debugOutputEnabled);
    this.delegate = HWIFileDownloadDelegateImpl.alloc().initWithDownloadManager(this);
    this.hwi = HWIFileDownloader.alloc().initWithDelegateMaxConcurrentDownloads(this.delegate, 5);
    this.ios = this.hwi;
    this.isReadyPromise = new Promise<void>((resolve) => {
      this.hwi.setupWithCompletionBlock(() => {
        this._log(`HWI.setup completed!`);
        this.loadPersistedTasks();
        this.cleanUpFinishedTasks();
        this.isReady = true;
        resolve();
      });
    });
  }

  // Used by HWI delegate
  public getTaskByRefId(refId: string): DownloadTaskIOS {
    return this.currentTasks[refId];
  }

  public getTaskByURL(url: string): DownloadTaskIOS {
    for (const refId in this.currentTasks) {
      if (this.currentTasks[+refId].request.url === url) {
        return this.currentTasks[refId];
      }
    }
    return null;
  }

  public setSessionIdentifier(sessionIdentifier: string) {
    this.sessionIdentifier = sessionIdentifier;
  }

  public updateTaskProgress(refId: string) {
    const task = this.getTaskByRefId(refId);
    if (task) {
      if (task.state !== DownloadState.RUNNING) {
        this.updateTaskState(refId, DownloadState.RUNNING);
      }
      task.latestProgress = this.hwi.downloadProgressForIdentifier(refId);
    }
  }

  public updateTaskState(refId: string, state: DownloadState, reason = 'none') {
    this._log(`Update task: refId=${refId} state=${state}, reason=${reason}`);
    const task = this.getTaskByRefId(refId);
    if (task) {
      task.state = state;
      task.reason = reason;
    }
    this.persistCurrentTasks();
  }
  // END Used by HWI delegate

  public downloadFile(request: DownloadRequest): Promise<number> {
    return this.isReadyPromise.then(() => {
      const destPath = request.destinationLocalUri;
      const tempFolder: fs.Folder = fs.knownFolders.temp();
      const tempOffsetIndex = destPath.indexOf(tempFolder.path);
      if (tempOffsetIndex === -1) {
        throw 'Download destination cannot be outside temp/cache directory on iOS.';
      }
      if (fs.File.exists(request.destinationLocalUri)) {
        fs.File.fromPath(request.destinationLocalUri).removeSync((err) => {
          throw `Download destination already exists and could not remove existing file. ${err}`;
        });
      }

      const refId: number = this.getNextRefId();
      this._log(`submit download: refId=${refId}, url=${request.url}, destination=${request.destinationLocalUri}`);
      const task = {
        refId: refId,
        request: request,
        latestProgress: null,
        state: DownloadState.PENDING,
        reason: 'none',
        downloadStartTimestamp: Number(new Date())
      };
      this.currentTasks[refId] = task;
      this.persistCurrentTasks();
      this.hwi.startDownloadWithIdentifierFromRemoteURL('' + refId, NSURL.URLWithString(request.url));
      return refId;
    });
  }

  public isDownloadInProgress(refId: number): boolean {
    if (!this.isReady) {
      return false;
    }
    const task = this.currentTasks[refId];
    try {
      return task && super.isDownloadInProgress(refId)
          && this.hwi.isDownloadingIdentifier(`${task.refId}`);
    } catch (err) {
      this._log(`isDownloadInProgress - Error: ${err}`);
      return false;
    }
  }

  public getDownloadStatus(refId: number): DownloadStatus {
    const task = this.currentTasks[refId];
    if (this.isReady && task) {
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

  public getDownloadsInProgress(): number[] {
    if (!this.isReady) {
      return [];
    }
    const refIdsInProgress: number[] = [];
    for (const key in this.currentTasks) {
      const refId: number = +key;
      if (this.isDownloadInProgress(+refId) && this.hwi.isDownloadingIdentifier(key)) {
        refIdsInProgress.push(+refId);
      }
    }
    return refIdsInProgress;
  }

  public getExternalFilesDirPath(): string {
    // temp/cache directory is where large files are stored on iOS. These will NOT be synced to iCloud.
    // see https://developer.apple.com/icloud/documentation/data-storage/index.html
    // TODO: Should we set ExcludedFromBackup flag?
    // see https://developer.apple.com/library/ios/qa/qa1719/_index.html
    return fs.knownFolders.temp().path;
  }

  public getPrivateFilesDirPath(): string {
    return fs.knownFolders.documents().path;
  }

  public getSizeOfFile(localFilePath: string): number {
    try {
      const fileMan = utils.ios.getter(NSFileManager, NSFileManager.defaultManager);
      const dict = fileMan.attributesOfItemAtPathError(localFilePath);
      const fileSize = dict.valueForKey(NSFileSize);
      return fileSize ? fileSize.longValue : 0;
    } catch (err) {
      this._log(`Error retrieving file size for path: ${localFilePath}`);
      return 0;
    }
  }

  public cancelDownloads(...refIds: number[]): void {
    if (!this.isReady) {
      return;
    }
    for (const refId of refIds) {
      try {
        this.hwi.cancelDownloadWithIdentifier('' + refId);
        delete this.currentTasks[refId];
      } catch (err) {
        this._log(`cancelDownloads - Error: ${err}`);
      }
    }
    this.persistCurrentTasks();
  }

  public cancelAllDownloads(): void {
    if (!this.isReady) {
      return;
    }
    for (const refId in this.currentTasks) {
      try {
        this.hwi.cancelDownloadWithIdentifier(refId);
        delete this.currentTasks[refId];
      } catch (err) {
        this._log(`cancelAllDownloads - Error: ${err}`);
      }
    }
    this.persistCurrentTasks();
  }

  public getAvailableDiskSpaceInBytes(): number {
    const fileMan: NSFileManager = utils.ios.getter(NSFileManager, NSFileManager.defaultManager);
    const paths = NSSearchPathForDirectoriesInDomains(NSSearchPathDirectory.DocumentDirectory, NSSearchPathDomainMask.UserDomainMask, true);
    const fileSystemAttDict = fileMan.attributesOfFileSystemForPathError(paths.lastObject);
    return fileSystemAttDict.objectForKey(NSFileSystemFreeSize);
  }

  public iosSetBackgroundSessionCompletionHandler(sessionIdentifier: string, completionHandler: () => void): void {
    this._log(`iosSetBackgroundSessionCompletionHandler sessionId=${sessionIdentifier}`);
    if (this.sessionIdentifier === sessionIdentifier) {
      this.hwi.setBackgroundSessionCompletionHandlerBlock(completionHandler);
    }
  }

  public destroy(): void {
    this.persistCurrentTasks();
    this.hwi = null;
    this.delegate = null;
    this.currentTasks = null;
  }

  private persistCurrentTasks() {
    appSettings.setString(DOWNLOADMANAGER_PERSISTANCE_KEY, JSON.stringify(this.currentTasks));
    this._log(`Persisted ${Object.keys(this.currentTasks).length} tasks`);
  }

  private loadPersistedTasks() {
    this.currentTasks = JSON.parse(appSettings.getString(DOWNLOADMANAGER_PERSISTANCE_KEY, '{}'));
    this._log(`Loaded ${Object.keys(this.currentTasks).length} persisted tasks`);
  }

  private getNextRefId(): number {
    return Object.keys(this.currentTasks).reduce((prev, cur) => Math.max(prev, +cur), 0) + 1;
  }

  private cleanUpFinishedTasks() {
    let didRemoveTask = false;
    for (const key in this.currentTasks) {
      const refId: number = +key;
      const task: DownloadTaskIOS = this.currentTasks[refId];

      // Finished or failed tasks are cleaned up when older than FINISHED_TASK_TIMEOUT.
      const dateDiffMillis = Number(new Date) - task.downloadStartTimestamp;

      if (!this.isInProgress(task.state) && dateDiffMillis > FINISHED_TASK_RETENTION_MS) {
        const oldDate = new Date(task.downloadStartTimestamp);
        this._log(`Cleaned old task: refId=${refId}, url=${task.request.url}, date=${oldDate.toDateString()}`);
        delete this.currentTasks[refId];
        didRemoveTask = true;
      }
    }
    if (didRemoveTask) {
      this.persistCurrentTasks();
    }
  }
}
