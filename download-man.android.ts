import * as app from "application";
import * as platform from "platform";

import {Common} from './download-man.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './download-man.types';
export * from './download-man.types';

interface StatFs_API18 extends android.os.StatFs {
  getAvailableBytes(): number;
  getAvailableBlocksLong(): number;
  getBlockSizeLong(): number;
}

export class DownloadManager extends Common {

  private _downloadManager: android.app.DownloadManager;

  constructor() {
    super();
  }

  private get downloadManager(): android.app.DownloadManager {
    if (!this._downloadManager) {
      this._downloadManager = app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
      // First time using the DownloadService, as good a time as any,
      // to make sure we have a .nomedia file at app storage root.
      const noMediaFile = new java.io.File(this.getExternalFilesDirPath(), '.nomedia');
      if (!noMediaFile.exists()) {
        noMediaFile.createNewFile();
      }
    }
    return this._downloadManager;
  }

  getExternalFilesDirPath(): string {
    // see https://developer.android.com/training/basics/data-storage/files.html
    return getAndroidAppContext().getExternalFilesDir(null).getCanonicalPath();
  }

  getSizeOfFile(localFilePath: string): number {
    return new java.io.File(localFilePath).length();
  }

  getDownloadState(refId: number): DownloadState {
    const status = getDownloadInfoLong(this.downloadManager, refId, android.app.DownloadManager.COLUMN_STATUS);
    return DownloadState[DownloadState[status]];
  }

  getDownloadStatus(refId: number): DownloadStatus {
    return getDownloadStatus(this.downloadManager, refId);
  }

  getDownloadsInProgress(): number[] {
    return getDownloadIdsByStatus(this.downloadManager, getInProgressStatusFlag());
  }

  downloadFile(request: DownloadRequest): Promise<number> {
    try {
      const uri = android.net.Uri.parse(request.url);
      const localUri = android.net.Uri.fromFile(new java.io.File(request.destinationLocalUri));
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
      return Promise.resolve(refId);
    } catch (ex) {
      console.log('DownloadManager exception: ' + ex);
      return Promise.reject(`Exception: ${ex}`);
    }
  }

  cancelDownloads(...refIds: number[]) {
    this.downloadManager.remove(refIds);
  }

  getAvailableDiskSpaceInBytes(): number {
    const stats = new android.os.StatFs(this.getExternalFilesDirPath());
    if (platform.device.sdkVersion >= "18") {
      return (<StatFs_API18>stats).getAvailableBytes();
    } else {
      return stats.getAvailableBlocks() * stats.getBlockSize();
    }
  }

  destroy() {
    app.android.unregisterBroadcastReceiver(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE);
  }
}




/* Private helpers */

function getAndroidAppContext(): android.content.Context {
  return app.android.context;
}

function getDownloadedFilePath(manager: android.app.DownloadManager, refId: number): string {
  return getDownloadInfoString(manager, refId, android.app.DownloadManager.COLUMN_LOCAL_FILENAME);
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
  return ~(android.app.DownloadManager.STATUS_FAILED | android.app.DownloadManager.STATUS_SUCCESSFUL);
}

function getDownloadStatus(manager: android.app.DownloadManager, refId: number): DownloadStatus {
  let query = new android.app.DownloadManager.Query();
  query.setFilterById([refId]);
  let cursor = manager.query(query);
  if (!cursor.moveToFirst()) {
    return null;
  }
  const status = getDownloadStatusFromCursor(cursor);
  cursor.close();
  return status;
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
  return cursor.getString(cursor.getColumnIndex(colIndex));
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