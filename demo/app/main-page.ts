import * as obs from 'tns-core-modules/data/observable';
import * as pages from 'tns-core-modules/ui/page';

// import { Observable } from 'rxjs/Observable';

import * as http from 'tns-core-modules/http';
import * as fs from 'tns-core-modules/file-system';

import { DownloadManager, DownloadRequest, DownloadStatus, DownloadState } from '@nota/nativescript-downloadmanager';

var model: obs.Observable;
var downloadManager: DownloadManager;

// Event handler for Page "loaded" event attached in main-page.xml
export function pageLoaded(args: obs.EventData) {
  // Get the event sender
  var page = <pages.Page>args.object;
  model = obs.fromObject({
    downloadState: '',
    progress: 0,
    spaceAvailable: 0
  });
  downloadManager = new DownloadManager();
  downloadManager.debugOutputEnabled = true;
  page.bindingContext = model;
}

export function onDownload() {
  console.log('onDownload');
  const downloadUrl = 'http://ipv4.download.thinkbroadband.com/100MB.zip';
  const destinationPath = fs.path.join(fs.knownFolders.temp().path, 'dest.zip');
  const req = new DownloadRequest(downloadUrl, destinationPath);
  req.allowedOverMetered = true;
  req.addHeader('LBS-User', '140345');
  req.addHeader('LBS-Token', 'LoremIpsum');
  downloadManager.downloadFile(req).then((refId) => {
    console.log(`Downloading with refId: ${refId}`);
    const progressInterval = setInterval(() => {
      const status = downloadManager.getDownloadStatus(refId);
      // console.log(`Download status: ${JSON.stringify(status)}`);
      if (status.state == DownloadState.RUNNING) {
        model.set('downloadState', `refId=${refId},state=${status.state},bytes=${status.bytesDownloaded}/${status.bytesTotal}`);
      } else {
        model.set('downloadState', `refId=${refId},state=${status.state},reason=${status.reason}`);
      }      
      model.set('progress', status.bytesTotal > 0 ? (status.bytesDownloaded / status.bytesTotal * 100) : 0);
      if (status.state === DownloadState.FAILED) {
        console.log(`Download FAILED! reason=${status.reason}`);
        clearInterval(progressInterval);
      } else if (status.state === DownloadState.SUCCESFUL) {
        console.log(`Download SUCCESS!`);
        clearInterval(progressInterval);
      }
    }, 1000);
  });
}

export function onShowStoredFiles() {
  console.log('onShowStoredFiles');
  traceFolderTree(fs.knownFolders.temp());
}

export function onShowSpace() {
  console.log('onShowSpace');
  const res = downloadManager.getAvailableDiskSpaceInBytes();
  const gb = res / (1024 * 1024 * 1024);
  model.set('spaceAvailable', Math.round(gb * 100) / 100); //round to 2 decimals
  // model.notifyPropertyChange('spaceAvailable', model.spaceAvailable);
}

function traceFolderTree(folder: fs.Folder, maxDepth: number = 3, depth: number = 0) {
  let whitespace = new Array(depth + 1).join('  ');
  if (depth === 0) {
    console.log(`${folder.path}`);
  }
  folder.eachEntity((ent) => {
    const isFolder = fs.Folder.exists(ent.path);
    console.log(`${whitespace} ${isFolder ? '-' : ' '}${ent.name}`);
    if (isFolder && depth < maxDepth) {
      try {
        traceFolderTree(fs.Folder.fromPath(ent.path), maxDepth, depth + 1);
      } catch(err) {
        console.log(`${whitespace}  * (err accessing)`);
      }
    }
    return true;
  });
}

function traceJavaFolderTree(folder: any, maxDepth: number = 3, depth: number = 0) {
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
