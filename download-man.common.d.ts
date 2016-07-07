import { DownloadManager, DownloadRequest, DownloadState, DownloadStatus } from './download-man.types';
export declare abstract class Common implements DownloadManager {
    isInProgress(state: DownloadState): boolean;
    isDownloadInProgress(refId: number): boolean;
    getDownloadState(refId: number): DownloadState;
    cancelAllDownloads(): void;
    abstract getExternalFilesDirPath(): string;
    abstract getDownloadsInProgress(): number[];
    abstract downloadFile(request: DownloadRequest): number;
    abstract getDownloadStatus(refId: number): DownloadStatus;
    abstract cancelDownloads(...refIds: Array<number>): any;
    abstract destroy(): any;
}
export declare class Utils {
    static SUCCESS_MSG(): string;
}
