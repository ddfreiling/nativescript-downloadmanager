export declare class DownloadRequest {
    url: string;
    destinationLocalUri: string;
    extraHeaders: {
        [key: string]: string;
    };
    allowedOverMetered: boolean;
    showNotification: boolean;
    notificationTitle: string;
    notificationDescription: string;
    constructor(url: string, destinationLocalUri: string);
    setNotification(title: string, description: string): void;
    addHeader(name: string, value: string): void;
}
export declare enum DownloadState {
    PENDING = 1,
    RUNNING = 2,
    PAUSED = 4,
    SUCCESFUL = 8,
    FAILED = 16,
}
export interface DownloadStatus {
    refId: number;
    title: string;
    downloadUri: string;
    localUri: string;
    bytesDownloaded: number;
    bytesTotal: number;
    state: number;
    reason: string;
}
export declare class DownloadManager {
    downloadFile(request: DownloadRequest): Promise<number>;
    isDownloadInProgress(refId: number): boolean;
    isInProgress(state: DownloadState): boolean;
    getDownloadsInProgress(): number[];
    getDownloadState(refId: number): DownloadState;
    getDownloadStatus(refId: number): DownloadStatus;
    cancelDownloads(...refIds: number[]): void;
    cancelAllDownloads(): void;
    getExternalFilesDirPath(): string;
    getSizeOfFile(localFilePath: string): number;
    destroy(): void;
}
