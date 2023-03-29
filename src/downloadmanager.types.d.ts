/**
 * Android specific download options.
 */
export interface AndroidDownloadRequestOptions {
    /**
     * Flag indicating whether a system notification should be shown for the download.
     */
    showNotification: boolean;
    /**
     * Title of the download notification, if enabled.
     */
    notificationTitle?: string;
    /**
     * Description text for the download notification, if enabled.
     */
    notificationDescription?: string;
}
/**
 * iOS specific download options.
 */
export interface iOSDownloadRequestOptions {
    /**
     * Timeout for the download request.
     * If idle time exceeds this, the download will fail.
     */
    timeout: number;
}
export declare class DownloadRequest {
    /**
     * URL to retrieve for the download request
     */
    url: string;
    /**
     * Local destination path for the completed download.
     */
    destinationLocalUri: string;
    /**
     * Extra request headers to send with the download.
     */
    extraHeaders: {
        [key: string]: string;
    };
    /**
     * Flag setting whether downloading should be allowed over a metered (cellular) connection.
     */
    allowedOverMetered: boolean;
    /**
     * iOS specific download options.
     */
    iosOptions: iOSDownloadRequestOptions;
    /**
     * Android specific download options.
     */
    androidOptions: AndroidDownloadRequestOptions;
    constructor(url: string, destinationLocalUri: string);
    /**
     * Convenience method to enable Android system download notification
     * and setting its title and description.
     */
    androidSetNotification(title: string, description: string): void;
    /**
     * Adds a custom header to be sent with the download request.
     * @param {string} name Name of the header
     * @param {string} value Value of the header
     */
    addHeader(name: string, value: string): void;
}
export declare enum DownloadState {
    PENDING = 1,
    RUNNING = 2,
    PAUSED = 4,
    SUCCESFUL = 8,
    FAILED = 16
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
    android: any;
    ios: any;
    debugOutputEnabled: boolean;
    constructor(debugOutputEnabled?: boolean);
    /**
     * Downloads a single file using a DownloadRequest
     * @return Promise<number> with reference ID to the started download.
     */
    downloadFile(request: DownloadRequest): Promise<number>;
    /**
     * Checks if a download is currently in-progress using a reference ID.
     */
    isDownloadInProgress(refId: number): boolean;
    /**
     * Checks if a given DownloadState is categorized as being in-progress.
     */
    isInProgress(state: DownloadState): boolean;
    /**
     * Gets the reference IDs of all downloads in progress.
     */
    getDownloadsInProgress(): number[];
    /**
     * Gets the DownloadState of a single download, for a given reference ID.
     */
    getDownloadState(refId: number): DownloadState;
    /**
     * Gets a detailed DownloadStatus for a given reference ID.
     */
    getDownloadStatus(refId: number): DownloadStatus;
    /**
     * Cancels downloads based on one or more reference IDs.
     */
    cancelDownloads(...refIds: number[]): void;
    /**
     * Cancels all active downloads.
     */
    cancelAllDownloads(): void;
    /**
     * Gets the absolute and canonical dir path,
     * for storing files externally.
     */
    getExternalFilesDirPath(): string;
    /**
     * Gets the absolute and canonical dir path,
     * for storing files inaccesible to the user.
     */
    getPrivateFilesDirPath(): string;
    /**
     * Gets the available disk space in bytes on the native platform.
     */
    getAvailableDiskSpaceInBytes(): number;
    /**
     * Gets the size of a local file in bytes.
     */
    getSizeOfFile(localFilePath: string): number;
    /**
     * Sets the iOS specific background-session completion handler.
     * The iOS platform provides this handler through the AppDelegate, when
     * an iOS app is awoken from background on download completion.
     */
    iosSetBackgroundSessionCompletionHandler(sessionIdentifier: string, completionHandler: () => void): void;
    /**
     * Clean up any resources or subscriptions held.
     */
    destroy(): void;
}
export interface HWIFileDownloadDelegate {
    customizeBackgroundSessionConfiguration?(aBackgroundSessionConfiguration: NSURLSessionConfiguration): void;
    decrementNetworkActivityIndicatorActivityCount(): void;
    downloadAtLocalFileURLIsValidForDownloadIdentifier?(aLocalFileURL: NSURL, aDownloadIdentifier: string): boolean;
    downloadDidCompleteWithIdentifierLocalFileURL(aDownloadIdentifier: string, aLocalFileURL: NSURL): void;
    downloadFailedWithIdentifierErrorHttpStatusCodeErrorMessagesStackResumeData(aDownloadIdentifier: string, anError: NSError, aHttpStatusCode: number, anErrorMessagesStack: NSArray<string>, aResumeData: NSData): void;
    downloadPausedWithIdentifierResumeData?(aDownloadIdentifier: string, aResumeData: NSData): void;
    downloadProgressChangedForIdentifier?(aDownloadIdentifier: string): void;
    httpStatusCodeIsValidForDownloadIdentifier?(aHttpStatusCode: number, aDownloadIdentifier: string): boolean;
    incrementNetworkActivityIndicatorActivityCount(): void;
    localFileURLForIdentifierRemoteURL?(aDownloadIdentifier: string, aRemoteURL: NSURL): NSURL;
    onAuthenticationChallengeDownloadIdentifierCompletionHandler?(aChallenge: NSURLAuthenticationChallenge, aDownloadIdentifier: string, aCompletionHandler: (p1: NSURLCredential, p2: NSURLSessionAuthChallengeDisposition) => void): void;
    resumeDownloadWithIdentifier?(aDownloadIdentifier: string): void;
    rootProgress?(): NSProgress;
    urlRequestForRemoteURL?(aRemoteURL: NSURL): NSURLRequest;
}
