
interface HWIFileDownloadDelegate {

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
declare var HWIFileDownloadDelegate: {

	prototype: HWIFileDownloadDelegate;
};

declare class HWIFileDownloadItem extends NSObject {

	static alloc(): HWIFileDownloadItem; // inherited from NSObject

	static new(): HWIFileDownloadItem; // inherited from NSObject

	bytesPerSecondSpeed: number;

	downloadStartDate: Date;

	readonly downloadToken: string;

	errorMessagesStack: NSArray<string>;

	expectedFileSizeInBytes: number;

	finalLocalFileURL: NSURL;

	lastHttpStatusCode: number;

	readonly progress: NSProgress;

	receivedFileSizeInBytes: number;

	resumedFileSizeInBytes: number;

	readonly sessionDownloadTask: NSURLSessionDownloadTask;

	readonly urlConnection: NSURLConnection;

	constructor(o: { downloadToken: string; sessionDownloadTask: NSURLSessionDownloadTask; urlConnection: NSURLConnection; });

	initWithDownloadTokenSessionDownloadTaskUrlConnection(aDownloadToken: string, aSessionDownloadTask: NSURLSessionDownloadTask, aURLConnection: NSURLConnection): this;
}

declare class HWIFileDownloadProgress extends NSObject {

	static alloc(): HWIFileDownloadProgress; // inherited from NSObject

	static new(): HWIFileDownloadProgress; // inherited from NSObject

	readonly bytesPerSecondSpeed: number;

	readonly downloadProgress: number;

	readonly estimatedRemainingTime: number;

	readonly expectedFileSize: number;

	lastLocalizedAdditionalDescription: string;

	lastLocalizedDescription: string;

	readonly nativeProgress: NSProgress;

	readonly receivedFileSize: number;

	constructor(o: { downloadProgress: number; expectedFileSize: number; receivedFileSize: number; estimatedRemainingTime: number; bytesPerSecondSpeed: number; progress: NSProgress; });

	initWithDownloadProgressExpectedFileSizeReceivedFileSizeEstimatedRemainingTimeBytesPerSecondSpeedProgress(aDownloadProgress: number, anExpectedFileSize: number, aReceivedFileSize: number, anEstimatedRemainingTime: number, aBytesPerSecondSpeed: number, aProgress: NSProgress): this;
}

declare var HWIFileDownloadVersionNumber: number;

declare var HWIFileDownloadVersionString: interop.Reference<number>;

declare class HWIFileDownloader extends NSObject {

	static alloc(): HWIFileDownloader; // inherited from NSObject

	static new(): HWIFileDownloader; // inherited from NSObject

	constructor(o: { delegate: NSObject; });

	constructor(o: { delegate: NSObject; maxConcurrentDownloads: number; });

	cancelDownloadWithIdentifier(aDownloadIdentifier: string): void;

	downloadProgressForIdentifier(aDownloadIdentifier: string): HWIFileDownloadProgress;

	hasActiveDownloads(): boolean;

	initWithDelegate(aDelegate: NSObject): this;

	initWithDelegateMaxConcurrentDownloads(aDelegate: NSObject, aMaxConcurrentFileDownloadsCount: number): this;

	isDownloadingIdentifier(aDownloadIdentifier: string): boolean;

	isWaitingForDownloadOfIdentifier(aDownloadIdentifier: string): boolean;

	setBackgroundSessionCompletionHandlerBlock(aBackgroundSessionCompletionHandlerBlock: () => void): void;

	setupWithCompletion(aSetupCompletionBlock: () => void): void;

	startDownloadWithIdentifierFromRemoteURL(aDownloadIdentifier: string, aRemoteURL: NSURL): void;

	startDownloadWithIdentifierUsingResumeData(aDownloadIdentifier: string, aResumeData: NSData): void;
}
