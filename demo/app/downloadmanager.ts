import app = require('application');

export interface DownloadProgress {
    bytes: number;
    totalBytes: number;
    completedLocalPath?: string;
}

export type DownloadProgressCallback = (bytes: number, totalBytes: number) => void;

export class DownloadRequest {
    url: string;
    extDirPath: string;
    extraHeaders: { [key:string]:string; } = {};
    allowedOverMetered: boolean = false;
    showNotification: boolean = false;
    notificationTitle: string;
    notificationDescription: string;
    progressCallback: DownloadProgressCallback;

    constructor(url: string, extDirPath: string) {
        this.url = url;
        this.extDirPath = extDirPath;
    }

    setNotification(title: string, description: string): DownloadRequest {
        this.showNotification = true;
        this.notificationTitle = title;
        this.notificationDescription = description;
        return this;
    }

    setProgressCallback(callback: DownloadProgressCallback): DownloadRequest {
        this.progressCallback = callback;
        return this;
    }

    addExtraHeader(name: string, value: string): DownloadRequest {
        this.extraHeaders[name] = value;
        return this;
    }
}

interface DownloadTask {
    progressCallback: DownloadProgressCallback;
    completionPromise: Promise<string>;
}

export class DownloadManager {

    private downloadObserverMap: { [refId:number]:Promise<string> } = {};

    constructor() {
        app.android.registerBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE, (context, intent: android.content.Intent) => {
            const refId: number = intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            this.onDownloadComplete(refId);
        });
    }

    private get downloadManager(): android.app.DownloadManager {
        return app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
    }

    getExternalFilesDirPath(filePath: string) {
        const extFilesDir = getAndroidAppContext().getExternalFilesDir(null);
        const f = new java.io.File(extFilesDir, filePath);
        return f.exists() ? f.getCanonicalPath() : null;
    }

    getIDsForDownloadsInProgress(): number[] {
        return getDownloadIdsByStatus(getInProgressStatusFlag());
    }

    downloadFileToExternalFolder(request: DownloadRequest) {
        const req = new android.app.DownloadManager.Request(android.net.Uri.parse(request.url));
        req.setShowRunningNotification(request.showNotification);
        req.setTitle(request.notificationTitle);
        req.setDescription(request.notificationDescription);
        for (let headerName in request.extraHeaders) {
            req.addRequestHeader(headerName, request.extraHeaders[headerName]);
        }
        req.setAllowedOverMetered(request.allowedOverMetered);
        req.setDestinationInExternalFilesDir(getAndroidAppContext(), ;
    }

    downloadFile(downloadUrl: string, toFolder: string, allowedOverMetered: boolean): Promise<string> {
        return new Promise((resolve, reject) => {
            const uri = android.net.Uri.parse(downloadUrl);
            const req = new android.app.DownloadManager.Request(android.net.Uri.parse(downloadUrl));
            req.setAllowedOverMetered(allowedOverMetered);
            req.setTitle("Skyggeforbandelsen");
            req.setDescription("LYT3");
            req.setDestinationInExternalFilesDir(getAndroidAppContext(), toFolder, uri.getLastPathSegment());
            try {
                const refId = this.downloadManager.enqueue(req);
                console.log('Request refId: '+ refId);
                monitorProgress(this.downloadManager, refId, observer);
                this.downloadObserverMap[refId] = new DownloadTask() observer;
                //console.log(JSON.stringify(this.downloadObserverMap));
            } catch(ex) {
                console.log('Caught exception: ' + ex);
                reject(ex);
            }
        });
    }

    cancelAllDownloads() {
        let downloadRefIds = Object.keys(this.downloadObserverMap).map((item) => parseInt(item))
        if (downloadRefIds.length > 0) {
            console.log(JSON.stringify(downloadRefIds));
            this.downloadManager.remove(downloadRefIds);
        }
    }
    
    cancelDownloads(...refIds: Array<number>) {
        this.downloadManager.remove(refIds);
    }

    onDownloadComplete(refId: number) {
        try {
            const downloadObservable = this.downloadObserverMap[refId];
            if (downloadObservable) {
                const localFilePath =  getDownloadedFilePath(this.downloadManager, refId);
                if (localFilePath) {
                    downloadObservable.complete();
                    console.log('Complete: '+ getDownloadStatus(this.downloadManager, refId));
                } else {
                    downloadObservable.error('Download failed or cancelled');
                }
                delete this.downloadObserverMap[refId];
            }
        } catch (ex) {
            console.log('err: '+ ex);
        }
    }

    destroy() {
        app.android.unregisterBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
    }
}

function getAndroidAppContext(): android.content.Context {
    return app.android.context;
}

var downloadStatusMap = {
    1: "STATUS_PENDING",
    2: "STATUS_RUNNING",
    4: "STATUS_PAUSED",
    8: "STATUS_SUCCESSFUL",
    16: "STATUS_FAILED",
}

function getDownloadedFilePath(manager: android.app.DownloadManager, refId: number): string {
    let query = new android.app.DownloadManager.Query();
    query.setFilterById([refId]);
    let cursor = manager.query(query);
    if (!cursor.moveToFirst()) {
        return null;
    }
    let localFilenameColumnIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_LOCAL_FILENAME);
    let localFilename = cursor.getString(localFilenameColumnIndex);
    cursor.close();
    return localFilename;
}

function getDownloadStatus(manager: android.app.DownloadManager, refId: number): string {
    let query = new android.app.DownloadManager.Query();
    query.setFilterById([refId]);
    let cursor = manager.query(query);
    if (!cursor.moveToFirst()) {
      return null;
    }
    let statusColumnIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_STATUS);
    let status = cursor.getInt(statusColumnIndex);
    cursor.close();
    return downloadStatusMap[status];
}

function getDownloadIdsByStatus(statusFlag: number) {
    const query = new android.app.DownloadManager.Query();
    query.setFilterByStatus(statusFlag);
    const cursor = this.downloadManager.query(query);
    const downloadRefIds = new Array<number>();
    while (cursor.moveToNext()) {
        const colIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_ID);
        downloadRefIds.push(cursor.getLong(colIndex));
    }
    return downloadRefIds;
}

function getInProgressStatusFlag(): number {
    return ~(android.app.DownloadManager.STATUS_FAILED | android.app.DownloadManager.STATUS_SUCCESSFUL)
}

function monitorProgress(manager: android.app.DownloadManager, refId: number, progressObserver: DownloadProgressCallback, updateInterval = 1000) {
    let lastReportedBytes = 0;
    let progressCheckInterval = setInterval(() => {
        let query = new android.app.DownloadManager.Query();
        query.setFilterById([refId]);
        query.setFilterByStatus(getInProgressStatusFlag());
        let cursorWasNotEmpty = false;
        let cursor = manager.query(query);
        if (!cursor.moveToFirst()) {
            console.log('Finished monitoring progress of download with refIds: '+ refId);
            clearInterval(progressCheckInterval);
            cursor.close();
            return;
        }
        do {
            let downloadedColIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            let totalColIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            let totalBytes = cursor.getLong(totalColIndex);
            let downloadedBytes = cursor.getLong(downloadedColIndex);
            if (totalBytes > 0) {
                if (downloadedBytes != lastReportedBytes) {
                    lastReportedBytes = downloadedBytes;
                    progressObserver(downloadedBytes, totalBytes);
                }
            }
        } while (cursor.moveToNext());
        cursor.close();
    }, updateInterval);
}