import * as fs from 'file-system';
import * as app from 'application';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs'

import { DownloadManager, DownloadRequest, DownloadStatus } from './downloadmanager';

const BookStorageFolderName = 'books';
const MagicFullyDownloadedFileName = 'fully_downloaded';
const BookMetadataFileName = 'metadata.json';

interface BookDownloadTask {
    bookId: string;
    dlManIDs: number[];
    dlFinishedForIDs: number[];
}

export class PersistanceModule {
    
    man: DownloadManager;
    
    constructor() {
        this.man = new DownloadManager();
    }
    
    debugPrintStorageFolder() {
        const bookFolder = getBookStorageFolder();
        console.log('Folder: '+ bookFolder.path);
        traceFolderTree(bookFolder);
    }
    
    deleteBook(bookId: string) {
        return fs.Folder.fromPath(getBookFolderPath(bookId)).clear();
    }
    
    getBookFolder(bookId: string) {
        return getBookFolderPath(bookId);
    }
    
    startDownloadingBook(bookId: string): Observable<DownloadStatus> {
        // get list of URIs from book contentlist
        const testDownloads = [
            { url: 'http://ipv4.download.thinkbroadband.com/1MB.zip', localUri: '1.mp3' },
            { url: 'http://ipv4.download.thinkbroadband.com/10MB.zip', localUri: '2.mp3' },
            { url: 'http://ipv4.download.thinkbroadband.com/20MB.zip', localUri: '3.mp3' },
        ];
        return Observable.from(testDownloads).concatMap((src) => {
            const req = new DownloadRequest(src.url, getPathForBookLocalUri(bookId, src.localUri));
            req.setNotification('Harry Potter: Fangen fra Azkaban', 'LYT3');
            req.allowedOverMetered = true;
            return this.man.downloadFile(req);
        }).finally<DownloadStatus>(() => {
            console.log('WRITING MAGIC FILE');
            const magicFilePath = fs.path.join(getBookFolderPath(bookId), MagicFullyDownloadedFileName);
            fs.File.fromPath(magicFilePath).writeText("");
        });
    }
    
    hasBookMetadata(bookId: string): boolean {
        return fs.File.exists(fs.path.join(getBookFolderPath(bookId), BookMetadataFileName));
    }
    
    loadBookMetadata(bookId: string): Promise<any> {
        const metaPath = fs.path.join(getBookFolderPath(bookId), BookMetadataFileName);
        const metaFile = fs.File.fromPath(metaPath);
        if (!fs.File.exists(metaPath)) {
            return Promise.reject('Cannot load metadata. Path does not exist: '+ metaPath);
        } else {
            return metaFile.readText().then((text) => JSON.parse(text));
        }
    }
    
    storeBookMetadata(bookId: string, bookMetadata: any): Promise<any> {
        const metaPath = fs.path.join(getBookFolderPath(bookId), BookMetadataFileName);
        const metaFile = fs.File.fromPath(metaPath);
        return metaFile.writeText(JSON.stringify(bookMetadata));
    }
    
    hasDownloadedBook(bookId: string) {
        return fs.File.exists(fs.path.join(getBookFolderPath(bookId), MagicFullyDownloadedFileName));
    }
    
    getProgressObserver(bookId: string) {
        
    }
    
    destroy() {
        
    }
}



/* Private */

function getBookStorageFolder(): fs.Folder {
    let extFolder = fs.knownFolders.documents();
    if (app.android) {
        const context: android.content.Context = app.android.context;
        extFolder = fs.Folder.fromPath(context.getExternalFilesDir(null).getCanonicalPath());
    }
    return extFolder.getFolder(BookStorageFolderName);
}

function getBookFolderPath(bookId: string): string {
    return fs.path.join(getBookStorageFolder().path, bookId);
}

function getPathForBookLocalUri(bookId: string, localUri: string) {
    return fs.path.join(getBookFolderPath(bookId), localUri);
}

function traceFolderTree(folder: fs.Folder, maxDepth: number = 3, depth: number = 0) {
    let whitespace = new Array(depth + 1).join('  ');
    console.log(`${whitespace}${folder.name}`);
    folder.eachEntity((ent) => {
        if (fs.Folder.exists(ent.path) && depth < maxDepth) {
            traceFolderTree(fs.Folder.fromPath(ent.path), maxDepth, depth + 1);
        } else {
            console.log(`${whitespace}- ${ent.name}`);
        }
        return true;
    });
}