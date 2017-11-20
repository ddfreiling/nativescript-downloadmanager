import * as app from "tns-core-modules/application";
import * as platform from "tns-core-modules/platform";

import {Common} from './downloadmanager.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './downloadmanager.types';
export * from './downloadmanager.types';

interface StatFsAPI18 extends android.os.StatFs {
  getAvailableBytes(): number;
  getAvailableBlocksLong(): number;
  getBlockSizeLong(): number;
}

export class DownloadManager extends Common {

  private _downloadManager: android.app.DownloadManager;

  constructor(debugOutputEnabled: boolean = false) {
    super(debugOutputEnabled);
    this.android = this.downloadManager;
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

  getPrivateFilesDirPath(): string {
    return getAndroidAppContext().getFilesDir().getCanonicalPath();
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
      // console.log(`Destination: ${localUri}`);
      // console.log(`ShowNoticicaiton: ${request.showNotification}`);
      const req = new android.app.DownloadManager.Request(android.net.Uri.parse(request.url));
      if (!request.showNotification) {
        // Permission needed to download without notification!
        req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_HIDDEN);
      }
      req.setTitle(request.notificationTitle);
      req.setDescription(request.notificationDescription);
      req.setVisibleInDownloadsUi(false);
      for (let headerName in request.extraHeaders) {
        // console.log(`Adding header ${headerName}=${request.extraHeaders[headerName]}`);
        req.addRequestHeader(headerName, request.extraHeaders[headerName]);
      }
      req.setAllowedOverMetered(request.allowedOverMetered);
      req.setDestinationUri(localUri);
      const refId = this.downloadManager.enqueue(req);
      // console.log('Request refId: ' + refId);
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
    if (+platform.device.sdkVersion >= 18) {
      return (<StatFsAPI18>stats).getAvailableBytes();
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
  const query = new android.app.DownloadManager.Query();
  query.setFilterById([refId]);
  const cursor = manager.query(query);
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
    reason: getReason(cursor),
  };
}

function getCursorLong(cursor: android.database.ICursor, colIndex: string): number {
  return cursor.getLong(cursor.getColumnIndex(colIndex));
}

function getCursorString(cursor: android.database.ICursor, colIndex: string): string {
  return cursor.getString(cursor.getColumnIndex(colIndex));
}

let reasons: Map<number, string>;
function ensureReason() {
  if (reasons) {
    return;
  }

  reasons = new Map<number, string>([
    [ android.app.DownloadManager.ERROR_CANNOT_RESUME, 'error_cannot_resume' ],
    [ android.app.DownloadManager.ERROR_DEVICE_NOT_FOUND, 'error_device_not_found' ],
    [ android.app.DownloadManager.ERROR_FILE_ALREADY_EXISTS, 'error_file_already_exists' ],
    [ android.app.DownloadManager.ERROR_FILE_ERROR, 'error_file_error' ],
    [ android.app.DownloadManager.ERROR_HTTP_DATA_ERROR, 'error_http_data_error' ],
    [ android.app.DownloadManager.ERROR_INSUFFICIENT_SPACE, 'error_insufficient_space' ],
    [ android.app.DownloadManager.ERROR_TOO_MANY_REDIRECTS, 'error_too_many_redirects' ],
    [ android.app.DownloadManager.ERROR_UNHANDLED_HTTP_CODE, 'error_unhandled_http_code' ],
    [ android.app.DownloadManager.ERROR_UNKNOWN, 'error_unknown' ],

    [ android.app.DownloadManager.PAUSED_QUEUED_FOR_WIFI, 'paused_queued_for_wifi' ],
    [ android.app.DownloadManager.PAUSED_WAITING_FOR_NETWORK, 'paused_waiting_for_network' ],
    [ android.app.DownloadManager.PAUSED_WAITING_TO_RETRY, 'paused_waiting_to_retry' ],
    [ android.app.DownloadManager.PAUSED_UNKNOWN, 'paused_unknown' ],

    [ 0, 'no' ],
  ]);
}

function getReason(cursor: android.database.ICursor): string {
  const reasonIndex = getCursorLong(cursor, android.app.DownloadManager.COLUMN_REASON);

  ensureReason();

  if (reasons.has(reasonIndex)) {
    return reasons.get(reasonIndex);
  }

  return 'placeholder';
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
