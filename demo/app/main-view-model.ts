import { Observable } from 'tns-core-modules/data/observable';
import { DownloadManager } from '@nota/nativescript-downloadmanager';

export class HelloWorldModel extends Observable {
  public message: string;
  public spaceAvailable: number;
  public progress: number;
  private yourPlugin: DownloadManager;

  constructor() {
    super();

    this.message = 'Demo app';
    this.spaceAvailable = 0;
    this.progress = 0;
  }
}
