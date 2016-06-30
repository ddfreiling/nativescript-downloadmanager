import * as observable from 'data/observable';
import * as pages from 'ui/page';
import {HelloWorldModel} from './main-view-model';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';

import app = require('application');
import fs = require("file-system");
import http = require("http");
import imageSource = require("image-source");

import {DownloadManager, DownloadRequest, DownloadStatus} from './download-manager';
import {PersistanceModule} from './persistance-module';
import {PermissionUtil} from './permission-util';

const dlMan = new DownloadManager();
const mod = new PersistanceModule();

var model: HelloWorldModel;

// Event handler for Page "loaded" event attached in main-page.xml
export function pageLoaded(args: observable.EventData) {
    // Get the event sender
    var page = <pages.Page>args.object;
    model = new HelloWorldModel();
    page.bindingContext = model;
}

var bookId = '123456';

export function onShowStoredFiles() {
    mod.debugPrintStorageFolder();
}

export function onDownloadBook() {
    mod.deleteBookContent(bookId).then(() => {
        mod.startDownloadingBook(bookId).subscribe((next) => {
            if (next.bytesTotal > 0) {
                const percent = Math.round(next.bytesDownloaded / next.bytesTotal * 100);
                model.progress = percent;
                model.notifyPropertyChange('progress', percent);
                console.log(`- Book download progress: ${percent}%`);
            } else {
                console.log(`- Book download progress: ${next.bytesDownloaded / 1000} kB`);
            }
        }, (err) => {
            console.log('--> Error: '+ err);
        }, () => {
            console.log('--> Book fully downloaded!');
        }); 
    });
}

export function onHasMeta() {
    console.log('onTest - bookFolder: '+ mod.getBookFolder(bookId));
    const hasBook = mod.hasBookMetadata(bookId);
    console.log('onTest - hasBook? '+ hasBook);
}

export function onLoadMeta() {
    mod.loadBookMetadata(bookId).then((meta) => {
        console.log('onLoadMeta - Done: '+ JSON.stringify(meta));
    }).catch((err) => {
        console.log('onLoadMeta - Error: '+ err);
    });
}

export function onStoreMeta() {
    mod.storeBookMetadata(bookId, { book: 'meta' }).then(() => {
        console.log('onStoreMeta - Done!');
    }).catch((err) => {
        console.log('onStoreMeta - Error: '+ err);
    });
}

export function onDownload() {
    console.log('onDownload');

    let docs: fs.Folder = fs.knownFolders.documents();
    let books: fs.Folder = fs.Folder.fromPath(fs.path.join(docs.path, "books"));

    //traceFolderTree(docs, 1);
    let bookPath = fs.path.normalize(fs.path.join(books.path, "/book123.zip"));
    let bookFile = fs.File.fromPath(bookPath);
    //let downloadUrl = 'http://ipv4.download.thinkbroadband.com/100MB.zip'; 
    let downloadUrl = 'http://ipv4.download.thinkbroadband.com/10MB.zip';
    //let downloadUrl = 'http://sagamusix.de/sample_collection/bass_drums.zip';
    console.log('Downloading book from: '+ downloadUrl);

    // let bookJavaFile = new java.io.File(docs.path);
    // traceJavaFolderTree(bookJavaFile, 1);
    let appContext: android.content.Context = app.android.context;
    //let extDir: java.io.File = appContext.getExternalFilesDir(null);
    //traceJavaFolderTree(extDir, 9);
    const extPath = fs.path.join(dlMan.getAndroidExternalFilesDir(), "books", "123", "book.zip");
    console.log('ext file path: '+ extPath);
    //traceFolderTree(dlMan.getAndroidExternalFilesDir(), 1);
    
    setInterval(() => {
        for (let id of dlMan.getIDsForDownloadsInProgress()) {
            console.log('in-progress: '+ id);
        }
    }, 1000);
    
    dlMan.downloadFile(new DownloadRequest(downloadUrl, extPath)).subscribe((next) => {
        console.log(`Progress: ${next.bytesDownloaded} / ${next.bytesTotal} (${Math.round(next.bytesDownloaded / next.bytesTotal * 100)})`);
    }, (err) => {
        console.log('Error! '+ err);
    }, () => {
        console.log('Completed!');
    });
}

export function onCancel() {
    dlMan.cancelAllDownloads();
}

function copyFile(file: java.io.File, toFile: java.io.File) {
    const fin = new java.io.FileInputStream(file);
    const fout = new java.io.FileOutputStream(toFile);
    try {
        let buffer = new Array<number>(4096);
        let bytesRead: number = 0;
        while ((bytesRead = fin.read(buffer)) > 0) {
            console.log('read: '+ buffer.slice(0, Math.min(bytesRead, 6)));
            fout.write(buffer, 0, bytesRead);
        }
        return true;
    } catch(ex) {
        console.error('Failed to copy file: '+ ex);
        return false;
    } finally {
        fin.close();
        fout.close();
    }
}

function unzipFile(zipFile: java.io.File, destinationFolder?: java.io.File) {
    // http://stackoverflow.com/questions/16142311/android-unzipping-files-programmatically-in-android
    if (!destinationFolder.isDirectory()) {
        throw new Error('destination not a directory');
    } else {
        // Destination defaults to folder with name of zipfile
        destinationFolder = new java.io.File(zipFile.getParentFile(), zipFile.getName());
        destinationFolder.mkdir();
    }
    console.log('attempt unzip of '+ zipFile.getAbsolutePath());
    try {
      const fin = new java.io.FileInputStream(zipFile);
      const zin = new java.util.zip.ZipInputStream(fin);
      let ze: java.util.zip.ZipEntry = null;
      while ((ze = zin.getNextEntry()) != null) {
          console.log('file in zip: '+ ze.getName());
          const outFile = new java.io.File(destinationFolder, ze.getName());
          if (ze.isDirectory() && !outFile.isDirectory) {
            outFile.mkdir();
          } else {
              console.log('Writing out file: '+ outFile.getCanonicalPath());
              const fout = new java.io.FileOutputStream(outFile);
              let buffer = (<any>Array).create('byte', 4096);
              let len = 0;
              while ((len = zin.read(buffer)) != -1) {
                  fout.write(buffer);
              }
              fout.close();
              zin.closeEntry();
          }
      }
      zin.close();
    } catch(ex) {
        console.log('Exception during unzip: ' + ex);
    }
}

function traceFolderTree(folder: fs.Folder, maxDepth: number = 3, depth: number = 0) {
    let whitespace = new Array(depth + 1).join('  ');
    console.log(`${whitespace}Folder: ${folder.path}`);
    folder.eachEntity((ent) => {
        console.log(`${whitespace}- ${ent.name}`);
        if (fs.Folder.exists(ent.path) && depth < maxDepth) {
            traceFolderTree(fs.Folder.fromPath(ent.path), maxDepth, depth + 1);
        }
        return true;
    });
}

function traceJavaFolderTree(folder: java.io.File, maxDepth: number = 3, depth: number = 0) {
    let whitespace = new Array(depth + 1).join('  ');
    console.log(`${whitespace}JavaFolder: ${folder.getCanonicalPath()}`);
    let files = folder.listFiles();
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        console.log(`${whitespace}- ${file.getName()}`);
        if (file.isDirectory() && depth < maxDepth)
        {
            traceJavaFolderTree(file, maxDepth, depth + 1);
        }
    }
}

function getAndroidAppContext(): android.content.Context {
    return app.android.context;
}