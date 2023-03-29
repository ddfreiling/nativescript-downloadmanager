/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

import { EventData, NavigatedData, Page } from '@nativescript/core'
import { path, knownFolders, Folder } from '@nativescript/core/file-system'

import { HomeViewModel } from './home-view-model'

export function onNavigatingTo(args: NavigatedData) {
  const page = <Page>args.object

  page.bindingContext = new HomeViewModel()
}

import { DownloadManager, DownloadRequest, DownloadStatus, DownloadState } from '@nota/nativescript-downloadmanager';

let downloadManager: DownloadManager;
let model = new HomeViewModel();

// Event handler for Page "loaded" event attached in main-page.xml
export function pageLoaded(args: EventData) {
  const page = <Page>args.object;
  downloadManager = new DownloadManager(true);
  downloadManager.debugOutputEnabled = true;
  page.bindingContext = model;
}

export function onDownload() {
  console.log('onDownload');
  const downloadUrl = 'https://sabnzbd.org/tests/internetspeed/50MB.bin';
  const destinationPath = path.join(knownFolders.temp().path, 'dest.zip');
  const req = new DownloadRequest(downloadUrl, destinationPath);
  req.allowedOverMetered = true;
  req.iosOptions.timeout = 240;
  req.androidSetNotification('Download test #1', 'Dette er en lang beskrivelse af din download.');
  req.androidOptions.notificationTitle = 'Download test #2';
  req.addHeader('LBS-User', '140345');
  req.addHeader('LBS-Token', 'LoremIpsum');
  downloadManager.downloadFile(req).then((refId) => {
    console.log(`Downloading with refId: ${refId}`);
    const progressInterval = setInterval(() => {
      const status = downloadManager.getDownloadStatus(refId);
      console.log(`Download status: ${JSON.stringify(status)}`);
      if (status.state === DownloadState.RUNNING) {
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
  traceFolderTree(knownFolders.temp());
}

export function onShowSpace() {
  console.log('onShowSpace');
  const res = downloadManager.getAvailableDiskSpaceInBytes();
  const gb = res / (1024 * 1024 * 1024);
  model.set('spaceAvailable', Math.round(gb * 100) / 100); // round to 2 decimals
  // model.notifyPropertyChange('spaceAvailable', model.spaceAvailable);
}

function traceFolderTree(folder: Folder, maxDepth: number = 3, depth: number = 0) {
  let whitespace = new Array(depth + 1).join('  ');
  if (depth === 0) {
    console.log(`${folder.path}`);
  }
  folder.eachEntity((ent) => {
    const isFolder = Folder.exists(ent.path);
    console.log(`${whitespace} ${isFolder ? '-' : ' '}${ent.name}`);
    if (isFolder && depth < maxDepth) {
      try {
        traceFolderTree(Folder.fromPath(ent.path), maxDepth, depth + 1);
      } catch (err) {
        console.log(`${whitespace}  * (err accessing)`);
      }
    }
    return true;
  });
}
