import * as http from 'http';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs';

import { DownloadManager, DownloadRequest, DownloadState, DownloadStatus } from '@nota/nativescript-downloadmanager';

export class DownloadJob {
  jobName: string;
  requests: DownloadRequest[] = [];
  status: DownloadJobStatus = new DownloadJobStatus();
  executeSequential: boolean = true; // TODO: Implement this option, always sequential atm.

  constructor(jobName: string, requests?: DownloadRequest[]) {
    this.jobName = jobName;
    if (requests) {
      this.requests = requests;
    }
  }

  getRequestQueue(): DownloadRequest[] {
    let offset = this.status.downloadsCompleted;
    if (this.status.currentDownloadRefId > -1) {
      offset += 1;
    }
    console.log('== REQUEST QUEUE ==', offset);
    return this.requests.slice(offset);
  }
}

export interface IDownloadJobStatus {
  currentDownloadRefId: number;
  downloadsCompletedRefIds: number[];
  downloadsTotal: number;
  bytesDownloadedByRefId: { [refId: number]: number };
  bytesTotal: number;
}

export class DownloadJobStatus implements IDownloadJobStatus {
  currentDownloadRefId = -1;
  downloadsCompletedRefIds: number[] = [];
  downloadsTotal = -1;
  bytesDownloadedByRefId: { [refId: number]: number } = {};
  bytesTotal = -1;

  constructor(parsedStatus?: IDownloadJobStatus) {
    if (parsedStatus) {
      this.currentDownloadRefId = parsedStatus.currentDownloadRefId;
      this.downloadsCompletedRefIds = parsedStatus.downloadsCompletedRefIds;
      this.downloadsTotal = parsedStatus.downloadsTotal;
      this.bytesDownloadedByRefId = parsedStatus.bytesDownloadedByRefId;
      this.bytesTotal = parsedStatus.bytesTotal;
    }
  }

  get bytesDownloaded(): number {
    return getObjectValueSum(this.bytesDownloadedByRefId);
  }

  get downloadsCompleted(): number {
    return this.downloadsCompletedRefIds.length; 
  }
}

type JobMap = { [jobName: string]: DownloadJob };

class JobStore {

  private static STORE_KEY = 'DownloadJobManagerStore';
  private currentJobs: JobMap = {};

  constructor() {
    this.load();
  }

  get allJobs(): DownloadJob[] {
    return Object.keys(this.currentJobs).map((key) => this.currentJobs[key]);
  }

  getJob(jobName: string) {
    return this.currentJobs[jobName];
  }

  updateJob(job: DownloadJob) {
    this.currentJobs[job.jobName] = job;
    this.persist();
  }

  deleteJob(jobName: string) {
    delete this.currentJobs[jobName];
    this.persist();
  }

  private persist() {
    appSettings.setString(JobStore.STORE_KEY, JSON.stringify(this.currentJobs));
    console.log('job-store: '+ JSON.stringify(this.currentJobs));
  }

  private load() {
    const parsedJobs = <JobMap>JSON.parse(appSettings.getString(JobStore.STORE_KEY, "{}"));
    for (const key of Object.keys(parsedJobs)) {
      const job = new DownloadJob(parsedJobs[key].jobName, parsedJobs[key].requests);
      job.status = new DownloadJobStatus(parsedJobs[key].status);
      this.currentJobs[key] = job;
    }
    console.log('job-store: '+ JSON.stringify(this.currentJobs));
  }
}

export class DownloadJobManager extends DownloadManager {

  public static ProgressUpdateInterval = 1000;
  // auto-loads persisted jobs from app-settings
  runningJobs: JobStore = new JobStore();

  constructor() {
    super();
    // cleanup any lingering finished jobs
    for (const job of this.runningJobs.allJobs) {
      if (!this.hasRunningJob(job.jobName)) {
        this.runningJobs.deleteJob(job.jobName);
      }
    }
  }

  deleteJob(jobName: string) {
    this.runningJobs.deleteJob(jobName);
  }

  deleteAllJobs() {
    for (const job of this.runningJobs.allJobs) {
      this.runningJobs.deleteJob(job.jobName);
    }
  }

  getRunningJobs() {
    return this.runningJobs.allJobs;
  }

  hasRunningJob(jobName: string): boolean {
    const job = this.runningJobs.getJob(jobName);
    return job && job.status.currentDownloadRefId > -1 && job.getRequestQueue().length > 0;
  }

  submitJob(job: DownloadJob) {
    job.status.downloadsTotal = job.requests.length;
    this.runningJobs.updateJob(job);
    console.log('added job '+ job.jobName);
  }

  getJobStatus(jobName: string): Observable<DownloadJobStatus> {
    const job = this.runningJobs.getJob(jobName);
    if (!job) {
      return Observable.throw('404 - Job not found');
    }
    return Observable.create((jobObserver: Observer<DownloadJobStatus>) => {
      //this.getJobTotalBytes(job).subscribe((bytesTotal) => {
        //job.status.bytesTotal = Math.max(bytesTotal, job.status.bytesTotal);
        //console.log('jobTotal: '+ bytesTotal);

        let requestQueueObs = Observable.from(job.getRequestQueue()).concatMap((req) => {
          console.log('==== CONTINUE ===');
          const refId = this.downloadFile(req);
          console.log(`_job-continue refId=${refId}, url=${req.url}`);
          console.log(`_job-completed ${JSON.stringify(job.status.downloadsCompletedRefIds)}`);
          job.status.currentDownloadRefId = refId;
          this.runningJobs.updateJob(job);
          return this.getDownloadStatusObservable(refId);
        });
        if (job.status.currentDownloadRefId > -1) {
          // If resuming, concat current download with queue
          console.log('CONCAT');
          requestQueueObs = this.getDownloadStatusObservable(job.status.currentDownloadRefId).concat(requestQueueObs);
        }
        this.subscribeToJobStatus(job, requestQueueObs, jobObserver);
      });
    //});
  }

  private subscribeToJobStatus(job: DownloadJob, obs: Observable<DownloadStatus>, observer: Observer<DownloadJobStatus>): void {
    obs.subscribe((status: DownloadStatus) => {
      if (job.status.downloadsCompletedRefIds.some((downedId) => downedId == status.refId)) {
        return;
      }
      job.status.currentDownloadRefId = status.refId;
      job.status.bytesDownloadedByRefId[status.refId] = status.bytesDownloaded;
      //job.status.downloadsTotal = job.status.downloadsCompletedRefIds.length + job.requestQueue.length;
      if (status.state == DownloadState.SUCCESFUL) {
        // One download complete
        job.status.downloadsCompletedRefIds.push(status.refId);
        job.status.bytesDownloadedByRefId[status.refId] = Math.max(status.bytesDownloaded, status.bytesTotal);
        this.runningJobs.updateJob(job);
      } else if (status.state == DownloadState.FAILED) {
        observer.error(`Download in queue failed: refId=${status.refId}, reason=${status.reason}`);
      }
      observer.next(job.status);
    }, (err) => {
      // Neccessary?
      observer.error(err);
    }, () => {
      // All downloads complete
      observer.complete();
      this.runningJobs.deleteJob(job.jobName);
    });
  }

  getDownloadStatusObservable(refId: number): Observable<DownloadStatus> {
    return Observable.create((obs: Observer<DownloadStatus>) => {
      let downloadInProgress = true;
      Observable.interval(DownloadJobManager.ProgressUpdateInterval).takeWhile(() => downloadInProgress).subscribe(() => {
        const status = this.getDownloadStatus(refId);
        //console.log(`_interval: refId=${status.refId}, state=${DownloadState[status.state]}`);
        //console.log('_interval', JSON.stringify(status));
        obs.next(status);
        if (status.state == DownloadState.FAILED) {
          obs.error(status.reason);
        }
        else if (!this.isInProgress(status.state)) {
          downloadInProgress = false;
          obs.complete();
        }
      });
    });
  }
  
  /**
   * Gets total bytes for all downloads in DownloadJob
   * WARN: Currently affected by a bug on Android on files larger than device RAM
   *       https://github.com/NativeScript/tns-core-modules-widgets/pull/42
   */
  public getJobTotalBytes(job: DownloadJob): Observable<number> {
    //TODO: Could start too many requests at once?
    console.log(`getJobTotalBytes of job with ${job.requests.length - job.status.downloadsCompleted} reqs left`);
    return Observable.from(job.requests).concatMap((req) => {
      console.log('Get size of '+ req.url);
      return Observable.fromPromise(http.request({
        method: 'HEAD',
        url: req.url
      }).then((response) => {
        const len = +<string>response.headers['Content-Length'];
        console.log('- Content-Length = '+ len);
        return len;
      }))
    }).reduce((acc, val) => acc += val, 0);
  }
}

function getObjectValueSum(obj: any): number {
  return Object.keys(obj).map(key => obj[key]).reduce((val, prev) => prev += val, 0);
}