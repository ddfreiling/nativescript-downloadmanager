import {Observable} from 'data/observable';
import {YourPlugin} from 'nativescript-persistance';

export class HelloWorldModel extends Observable {
  public message: string;
  public progress: number;
  private yourPlugin: YourPlugin;

  constructor() {
    super();

    this.yourPlugin = new YourPlugin();
    this.message = this.yourPlugin.message;
    this.progress = 0;
  }
}