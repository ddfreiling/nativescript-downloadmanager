import * as app from 'application';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs'

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

export enum DownloadState {
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


export class DownloadManager {

    private _progressMonitorInterval: any;
    private _downloadManager: android.app.DownloadManager;
    private _downloadObserverMap: { [refId:number]:Observer<DownloadStatus> } = {};

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

    getAndroidExternalFilesDir(): string {
        return getAndroidAppContext().getExternalFilesDir(null).getCanonicalPath();
    }

    getDownloadStatus(refId: number): Observable<DownloadStatus> {
        if (this._downloadObserverMap[refId] && !this._downloadObserverMap[refId].isUnsubscribed) {
            throw new Error('Download observable already created and currently subscribed to');
        }
        return Observable.create((observer: Observer<DownloadStatus>) => {
            this._downloadObserverMap[refId] = observer;
            monitorProgress(this.downloadManager, refId, observer);
        });
    }

    getIDsForDownloadsInProgress(): number[] {
        return getDownloadIdsByStatus(this.downloadManager, getInProgressStatusFlag());
    }

    downloadFile(request: DownloadRequest): Observable<DownloadStatus> {
        return Observable.create((observer: Observer<DownloadStatus>) => {
            try {
                const uri = android.net.Uri.parse(request.url);
                const localUri = android.net.Uri.fromFile(new java.io.File(request.toLocalUri));
                console.log(`Destination: ${localUri}`);
                console.log(`ShowNoticicaiton: ${request.showNotification}`);
                const req = new android.app.DownloadManager.Request(android.net.Uri.parse(request.url));
                if (!request.showNotification) {
                    // Permission needed to download without notification!
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
                this._downloadObserverMap[refId] = observer;
                monitorProgress(this.downloadManager, refId, observer);
            } catch(ex) {
                console.log('DownloadManager exception: ' + ex);
                observer.error(ex);
            }
        });
    }

    cancelAllDownloads() {
        let downloadRefIds = Object.keys(this._downloadObserverMap).map((item) => parseInt(item))
        if (downloadRefIds.length > 0) {
            console.log('Cancel downloads: '+ JSON.stringify(downloadRefIds));
            this.downloadManager.remove(downloadRefIds);
        } else {
            console.log('No downloads to cancel...');
        }
    }
    
    cancelDownloads(...refIds: Array<number>) {
        this.downloadManager.remove(refIds);
    }

    destroy() {
        app.android.unregisterBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
    }

    private onDownloadComplete(refId: number) {
        try {
            const downloadObserver = this._downloadObserverMap[refId];
            if (downloadObserver) {
                const status: DownloadStatus = getDownloadStatus(this.downloadManager, refId);
                console.log('Download completed with state: '+ DownloadState[status.state]);
                if (status.state == DownloadState.SUCCESFUL) {
                    const localFilePath =  getDownloadedFilePath(this.downloadManager, refId);
                    console.log('- to local file path: '+ localFilePath);
                    downloadObserver.complete();
                } else {
                    downloadObserver.error(`Download failed. ${DownloadState[status.state]} = ${status.reason}`);
                }
                delete this._downloadObserverMap[refId];
            }
        } catch (ex) {
            console.log('onDownloadComplete error: '+ ex);
        }
    }
}





/* Private */

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

function monitorProgress(manager: android.app.DownloadManager, refId: number, progressObserver: Observer<DownloadStatus>, updateInterval = 1000) {
    let lastReportedBytesDownloaded = 0;
    const progressCheckInterval = setInterval(() => {
        console.log('_interval-start '+ refId);
        
        const status = getDownloadStatus(manager, refId);
        
        if (status && isActiveDownloadState(status.state)) {
            console.log(`_interval ${refId}/${status.refId} state = ${DownloadState[status.state]}`);
            if (status.bytesDownloaded != lastReportedBytesDownloaded) {
                lastReportedBytesDownloaded = status.bytesDownloaded;
                progressObserver.next(status);
            }
        } else {
            console.log('_clear-interval '+ refId);
            clearInterval(progressCheckInterval);
            console.log('Finished monitoring progress of download with refId: '+ refId);
        }
    }, updateInterval);
}

function isActiveDownloadState(state: DownloadState) {
    return state & getInProgressStatusFlag();
}

function getInProgressStatusFlag(): number {
    return ~(android.app.DownloadManager.STATUS_FAILED | android.app.DownloadManager.STATUS_SUCCESSFUL);
}

function getDownloadStatus(manager: android.app.DownloadManager, refId: number): DownloadStatus {
    let query = new android.app.DownloadManager.Query();
    query.setFilterById([refId]);
    let cursor = manager.query(query);
    if (!cursor.moveToFirst()) {
        return null;
    }
    const info = getDownloadStatusFromCursor(cursor);
    cursor.close();
    return info;
}

function getDownloadStatusFromCursor(cursor: android.database.ICursor): DownloadStatus {
    return {
        refId: getCursorLong(cursor, android.app.DownloadManager.COLUMN_ID),
        title: getCursorString(cursor, android.app.DownloadManager.COLUMN_TITLE),
        bytesDownloaded: getCursorLong(cursor, android.app.DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
        bytesTotal: getCursorLong(cursor, android.app.DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
        downloadUri: getCursorString(cursor, android.app.DownloadManager.COLUMN_URI),
        localUri: getCursorString(cursor, android.app.DownloadManager.COLUMN_LOCAL_URI),
        state: getCursorLong(cursor, android.app.DownloadManager.COLUMN_STATUS),
        reason: getCursorString(cursor, android.app.DownloadManager.COLUMN_REASON)
    };
}

function getCursorLong(cursor: android.database.ICursor, colIndex: string): number {
    return cursor.getLong(cursor.getColumnIndex(colIndex));
}

function getCursorString(cursor: android.database.ICursor, colIndex: string): string {
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