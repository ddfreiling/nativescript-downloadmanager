import * as observable from 'data/observable';
import * as pages from 'ui/page';
import {HelloWorldModel} from './main-view-model';

import { Observable } from 'rxjs/Observable';

import http = require('http');
import fs = require("file-system");

import {DownloadManager, DownloadRequest, DownloadStatus} from '@nota/nativescript-downloadmanager';
import {DownloadJobStatus} from './download-job-manager';
import {PersistanceModule} from './persistance-module';

const man = new DownloadManager();
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
  mod.deleteBookContents(bookId).then(() => {
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

export function onDeleteJobs() {
  mod.stopAllBookDownloads();
}

export function onDownloadBookJob() {
  mod.deleteBookContents(bookId).then(() => {
    downloadBook(bookId);
  });
}

export function onDownloadBookResume() {
  downloadBook(bookId);
}

function downloadBook(bookId: string) {
  mod.startDownloadingBook(bookId).subscribe((next) => {
    let percent = Math.round((next.bytesTotal > 0) ?
      next.bytesDownloaded / next.bytesTotal * 100 :
      next.downloadsCompleted / next.downloadsTotal * 100
    );
    model.progress = percent;
    model.notifyPropertyChange('progress', percent);
    console.log(`- Book download progress: ${percent}%`);
    console.log(`- Book download progress: ${next.downloadsCompleted} / ${next.downloadsTotal} completed`);
    console.log(`- Book download progress: ${Math.round(next.bytesDownloaded / 1000)} / ${Math.round(next.bytesTotal / 1000)} kB`);
  }, (err) => {
    console.log('--> Error: '+ err);
  }, () => {
    console.log('--> Book fully downloaded!');
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
  let downloadUrl = 'http://ipv4.download.thinkbroadband.com/100MB.zip';
  //let downloadUrl = 'http://sagamusix.de/sample_collection/bass_drums.zip';
  console.log('Downloading book from: '+ downloadUrl);

  // let bookJavaFile = new java.io.File(docs.path);
  // traceJavaFolderTree(bookJavaFile, 1);
  //let appContext: android.content.Context = app.android.context;
  //let extDir: java.io.File = appContext.getExternalFilesDir(null);
  //traceJavaFolderTree(extDir, 9);
  const extPath = fs.path.join(man.getExternalFilesDirPath(), "books", "123", "book.zip");
  console.log('ext file path: '+ extPath);
  //traceFolderTree(dlMan.getAndroidExternalFilesDir(), 1);
  
  const req = new DownloadRequest(downloadUrl, extPath);
  req.allowedOverMetered = true;
  man.downloadFile(req).then((refId) => {
    console.log('== START OBS ==');
    Observable.interval(1000).map(() => man.getDownloadStatus(refId))
        .takeWhile((status) => man.isInProgress(status.state)).subscribe((next) => {
      console.log(`Progress: ${next.refId} > ${next.bytesDownloaded} / ${next.bytesTotal} (${Math.round(next.bytesDownloaded / next.bytesTotal * 100)}%)`);
    }, (err) => {
      console.log('Error! '+ err);
    }, () => {
      console.log('Completed!');
    });
  }).catch((err) => {
    console.log('downloadFile error: '+ err);
  });
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