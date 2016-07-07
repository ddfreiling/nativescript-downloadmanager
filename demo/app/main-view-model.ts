import {Observable} from 'data/observable';
import {DownloadManager} from '@nota/nativescript-downloadmanager';

export class HelloWorldModel extends Observable {
  public message: string;
  public progress: number;
  private yourPlugin: DownloadManager;

  constructor() {
    super();

    this.yourPlugin = new DownloadManager();
    this.message = 'Demo app';
    this.progress = 0;
  }
}