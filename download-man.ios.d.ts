import { Common } from './download-man.common';
import { DownloadRequest, DownloadStatus } from './download-man.types';
export * from './download-man.types';
export declare class DownloadManager extends Common {
    downloadFile(request: DownloadRequest): number;
    isDownloadInProgress(refId: number): boolean;
    getDownloadStatus(refId: number): DownloadStatus;
    getDownloadsInProgress(): any[];
    getExternalFilesDirPath(): string;
    cancelDownloads(...refIds: number[]): void;
    cancelAllDownloads(): void;
    destroy(): void;
}
