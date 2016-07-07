import { Common } from './download-man.common';
import { DownloadRequest, DownloadState, DownloadStatus } from './download-man.types';
export * from './download-man.types';
export declare class DownloadManager extends Common {
    private _downloadManager;
    constructor();
    private downloadManager;
    getExternalFilesDirPath(): string;
    getDownloadState(refId: number): DownloadState;
    getDownloadStatus(refId: number): DownloadStatus;
    getDownloadsInProgress(): number[];
    downloadFile(request: DownloadRequest): number;
    cancelDownloads(...refIds: number[]): void;
    destroy(): void;
}
