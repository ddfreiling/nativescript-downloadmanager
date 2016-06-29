import * as app from 'application';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs'

export interface DownloadProgress {
    bytes: number;
    totalBytes: number;
    completedLocalPath?: string;
}

export class DownloadRequest {
    url: string;
    toLocalUri: string;
    extraHeaders: { [key:string]:string; } = {};
    allowedOverMetered: boolean = false;
    showNotification: boolean = false;
    notificationTitle: string;
    notificationDescription: string;

    constructor(url: string, toLocalUri: string) {
        this.url = url;
        this.toLocalUri = toLocalUri;
    }

    setNotification(title: string, description: string): void {
        this.showNotification = true;
        this.notificationTitle = title;
        this.notificationDescription = description;
    }

    addHeader(name: string, value: string): void {
        this.extraHeaders[name] = value;
    }
}

export class DownloadInfoStatus {
    PENDING = 1;
    RUNNING = 2;
    PAUSED = 4;
    SUCCESFUL = 8;
    FAILED = 16;
}

export interface DownloadInfo {
    refId: number;
    title: string;
    downloadUri: string;
    localUri: string;
    bytesDownloaded: number;
    bytesTotal: number;
    status: number;
    reason: string;
}

export enum DownloadState {
    PENDING = 1,
    RUNNING = 2,
    PAUSED = 4,
    SUCCESFUL = 8,
    FAILED = 16,
}

export interface DownloadStatus {
    refId: number;
    bytesDownloaded: number;
    bytesTotal: number;
}





export class DownloadManager {

    private _downloadManager: android.app.DownloadManager;
    //private downloadTaskMap: { [refId:number]:Observer<DownloadStatus> } = {};
    private downloadObserverMap: { [refId:number]:Observer<DownloadStatus> } = {};

    constructor() {
        app.android.registerBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE, (context, intent: android.content.Intent) => {
            const refId: number = intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            this.onDownloadComplete(refId);
        });
    }

    private get downloadManager(): android.app.DownloadManager {
        if (!this._downloadManager) {
            this._downloadManager = app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
        }
        return this._downloadManager;
    }

    public getAndroidExternalFilesDir(): string {
        return getAndroidAppContext().getExternalFilesDir(null).getCanonicalPath();
    }

    public getDownloadStatus(refId: number): Observable<DownloadStatus> {
        if (this.downloadObserverMap[refId] && !this.downloadObserverMap[refId].isUnsubscribed) {
            throw new Error('Download observable already created and currently subscribed to');
        }
        return Observable.create((observer: Observer<DownloadStatus>) => {
            this.downloadObserverMap[refId] = observer;
            monitorProgress(this.downloadManager, refId, observer);
        });
    }

    public getIDsForDownloadsInProgress(): number[] {
        return getDownloadIdsByStatus(this.downloadManager, getInProgressStatusFlag());
    }

    public downloadFile(request: DownloadRequest): Observable<DownloadStatus> {
        return Observable.create((observer: Observer<DownloadStatus>) => {
            try {
                const uri = android.net.Uri.parse(request.url);
                const localUri = android.net.Uri.fromFile(new java.io.File(request.toLocalUri));
                console.log(`Destination: ${localUri}`);
                console.log(`ShowNoticicaiton: ${request.showNotification}`);
                const req = new android.app.DownloadManager.Request(android.net.Uri.parse(request.url));
                if (!request.showNotification) {
                    //TODO: Need permission to download without notificaiton!
                    req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_HIDDEN);
                }
                req.setTitle(request.notificationTitle);
                req.setDescription(request.notificationDescription);
                for (let headerName in request.extraHeaders) {
                    console.log(`Adding header ${headerName}=${request.extraHeaders[headerName]}`);
                    req.addRequestHeader(headerName, request.extraHeaders[headerName]);
                }
                req.setAllowedOverMetered(request.allowedOverMetered);
                req.setDestinationUri(localUri);
                const refId = this.downloadManager.enqueue(req);
                console.log('Request refId: ' + refId);
                this.downloadObserverMap[refId] = observer;
                monitorProgress(this.downloadManager, refId, observer);
            } catch(ex) {
                console.log('DownloadManager exception: ' + ex);
                observer.error(ex);
            }
        });
    }

    public cancelAllDownloads() {
        let downloadRefIds = Object.keys(this.downloadObserverMap).map((item) => parseInt(item))
        if (downloadRefIds.length > 0) {
            console.log(JSON.stringify(downloadRefIds));
            this.downloadManager.remove(downloadRefIds);
        }
    }
    
    public cancelDownloads(...refIds: Array<number>) {
        this.downloadManager.remove(refIds);
    }

    public destroy() {
        app.android.unregisterBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
    }

    private onDownloadComplete(refId: number) {
        try {
            const downloadObserver = this.downloadObserverMap[refId];
            if (downloadObserver) {
                const state: DownloadState = getDownloadState(this.downloadManager, refId);
                console.log('Download completed with state: '+ state);
                if (state == DownloadState.SUCCESFUL) {
                    const localFilePath =  getDownloadedFilePath(this.downloadManager, refId);
                    console.log('- to local file path: '+ localFilePath);
                    downloadObserver.complete();
                } else {
                    downloadObserver.error('Download failed or cancelled');
                }
                delete this.downloadObserverMap[refId];
            }
        } catch (ex) {
            console.log('onDownloadComplete error: '+ ex);
        }
    }
}





/* UTILS */

function getAndroidAppContext(): android.content.Context {
    return app.android.context;
}

function getDownloadedFilePath(manager: android.app.DownloadManager, refId: number): string {
    return getDownloadInfoString(manager, refId, android.app.DownloadManager.COLUMN_LOCAL_FILENAME);
}

function getDownloadState(manager: android.app.DownloadManager, refId: number): DownloadState {
    const status = getDownloadInfoLong(manager, refId, android.app.DownloadManager.COLUMN_STATUS);
    return DownloadState[DownloadState[status]];
}

function getDownloadIdsByStatus(manager: android.app.DownloadManager, statusFlag: number) {
    const query = new android.app.DownloadManager.Query();
    query.setFilterByStatus(statusFlag);
    const cursor = manager.query(query);
    const downloadRefIds = new Array<number>();
    while (cursor.moveToNext()) {
        downloadRefIds.push(getCursorLong(cursor, android.app.DownloadManager.COLUMN_ID));
    }
    return downloadRefIds;
}

function getInProgressStatusFlag(): number {
    return ~(android.app.DownloadManager.STATUS_FAILED | android.app.DownloadManager.STATUS_SUCCESSFUL)
}

function monitorProgress(manager: android.app.DownloadManager, refId: number, progressObserver: Observer<DownloadStatus>, updateInterval = 1000) {
    let lastReportedBytesDownloaded = 0;
    let progressCheckInterval = setInterval(() => {
        let query = new android.app.DownloadManager.Query();
        query.setFilterById([refId]);
        query.setFilterByStatus(getInProgressStatusFlag());
        let cursor = manager.query(query);
        if (cursor.moveToFirst()) {
            let bytesTotal = getCursorLong(cursor, android.app.DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            let bytesDownloaded = getCursorLong(cursor, android.app.DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            if (bytesDownloaded != lastReportedBytesDownloaded) {
                lastReportedBytesDownloaded = bytesDownloaded;
                progressObserver.next({refId: refId, bytesDownloaded: bytesDownloaded, bytesTotal: bytesTotal});
            }
        } else {
            clearInterval(progressCheckInterval);
            console.log('Finished monitoring progress of download with refId: '+ refId);
        }
        cursor.close();
    }, updateInterval);
}

function getDownloadInfo(manager: android.app.DownloadManager, refId: number) {
    let query = new android.app.DownloadManager.Query();
    query.setFilterById([refId]);
    let cursor = manager.query(query);
    if (!cursor.moveToFirst()) {
        return null;
    }
    const info: DownloadInfo = {
        refId: refId,
        title: getCursorString(cursor, android.app.DownloadManager.COLUMN_TITLE),
        bytesDownloaded: getCursorLong(cursor, android.app.DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
        bytesTotal: getCursorLong(cursor, android.app.DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
        downloadUri: getCursorString(cursor, android.app.DownloadManager.COLUMN_URI),
        localUri: getCursorString(cursor, android.app.DownloadManager.COLUMN_LOCAL_URI),
        status: getCursorLong(cursor, android.app.DownloadManager.COLUMN_STATUS),
        reason: getCursorString(cursor, android.app.DownloadManager.COLUMN_REASON)
    };
    cursor.close();
    return info;
}

function getCursorLong(cursor: android.database.Cursor, colIndex: string): number {
    return cursor.getLong(cursor.getColumnIndex(colIndex));
}

function getCursorString(cursor: android.database.Cursor, colIndex: string): string {
    return cursor.getString(cursor.getColumnIndex(colIndex))
}

function getDownloadInfoLong(manager: android.app.DownloadManager, refId: number, colName: string): number {
    const cursor = manager.query(new android.app.DownloadManager.Query().setFilterById([refId]));
    if (!cursor.moveToFirst()) {
        return null;
    }
    const result = getCursorLong(cursor, colName);
    cursor.close();
    return result;
}

function getDownloadInfoString(manager: android.app.DownloadManager, refId: number, colName: string): string {
    const cursor = manager.query(new android.app.DownloadManager.Query().setFilterById([refId]));
    if (!cursor.moveToFirst()) {
        return null;
    }
    const result = getCursorString(cursor, colName);
    cursor.close();
    return result;
}