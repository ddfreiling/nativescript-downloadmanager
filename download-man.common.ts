import * as app from 'application';
import { DownloadManager, DownloadRequest, DownloadState, DownloadStatus } from './download-man.types';


export abstract class Common implements DownloadManager {

  isInProgress(state: DownloadState): boolean {
    return (state != DownloadState.FAILED && state != DownloadState.SUCCESFUL);
  }

  isDownloadInProgress(refId: number): boolean {
    const state = this.getDownloadState(refId);
    return state && this.isInProgress(state);
  }

  getDownloadState(refId: number): DownloadState {
    const status = this.getDownloadStatus(refId);
    if (!status) return null;
    else return status.state;
  }

  cancelAllDownloads(): void {
    this.cancelDownloads(...this.getDownloadsInProgress());
  }

  public abstract getExternalFilesDirPath(): string;
  public abstract getDownloadsInProgress(): number[];
  public abstract downloadFile(request: DownloadRequest): number;
  public abstract getDownloadStatus(refId: number): DownloadStatus;
  public abstract cancelDownloads(...refIds: Array<number>);
  public abstract destroy();
}

export class Utils {
  public static SUCCESS_MSG(): string {
    let msg = `Your plugin is working on ${app.android ? 'Android' : 'iOS'}.`;
    return msg;
  }
}

