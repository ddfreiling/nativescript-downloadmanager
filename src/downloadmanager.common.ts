import * as app from 'tns-core-modules/application';
import { isIOS } from 'tns-core-modules/platform';
import { DownloadManager, DownloadRequest, DownloadState, DownloadStatus } from './downloadmanager.types';

export abstract class Common implements DownloadManager {

  private static PLATFORM = isIOS ? 'iOS' : 'android';

  public android: any;
  public ios: any;

  public debugOutputEnabled: boolean;

  constructor(debugOutputEnabled = false) {
    this.debugOutputEnabled = debugOutputEnabled;
  }

  public isInProgress(state: DownloadState): boolean {
    return (state !== DownloadState.FAILED && state !== DownloadState.SUCCESFUL);
  }

  public getDownloadState(refId: number): DownloadState {
    const status = this.getDownloadStatus(refId);
    if (!status) {
      return null;
    } else {
      return status.state;
    }
  }

  public isDownloadInProgress(refId: number): boolean {
    const state = this.getDownloadState(refId);
    return state && this.isInProgress(state);
  }

  public cancelAllDownloads(): void {
    this.cancelDownloads(...this.getDownloadsInProgress());
  }

  public abstract getExternalFilesDirPath(): string;
  public abstract getPrivateFilesDirPath(): string;
  public abstract getSizeOfFile(localFilePath: string): number;
  public abstract getDownloadsInProgress(): number[];
  public abstract downloadFile(request: DownloadRequest): Promise<number>;
  public abstract getDownloadStatus(refId: number): DownloadStatus;
  public abstract cancelDownloads(...refIds: number[]);
  public abstract getAvailableDiskSpaceInBytes(): number;
  public abstract iosSetBackgroundSessionCompletionHandler(sessionIdentifier: string, completionHandler: () => void): void;
  public abstract destroy();

  public _log(logStr: string) {
    if (this.debugOutputEnabled) {
      console.log(`tns-downloadmanager(${Common.PLATFORM}): ${logStr}`);
    }
  }
}
