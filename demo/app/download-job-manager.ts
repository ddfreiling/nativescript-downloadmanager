import * as http from 'http';
import * as appSettings from 'application-settings';

import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs'

import { DownloadManager, DownloadRequest, DownloadStatus, DownloadState } from './download-manager';

export interface DownloadJob {
    jobName: string;
    requests: DownloadRequest[];
    executeSequential: boolean; // TODO: Implement this option, always sequential atm.
}

export interface DownloadJobStatus {
    jobName: string;
    downloadsCompleted: number;
    downloadsTotal: number;
    bytesDownloaded: number;
    bytesTotal: number;
}

/**
 * TODO:
 * Persist job queue and 'reload' the observable DownloadJobStatus on startup
 */

export class DownloadJobManager extends DownloadManager {
    
    private getObjectValueSum(obj: any): number {
        return Object.keys(obj).map(key => obj[key]).reduce((val, prev) => prev += val);
    }
    
    startDownloadJob(job: DownloadJob): Observable<DownloadJobStatus> {
        const downloadCount: number = job.requests.length;
        let downloadsCompleted: number = 0;
        let bytesDownloaded: { [refId:number]:number } = {}
        return Observable.create((observer: Observer<DownloadJobStatus>) => {
            this.getJobTotalBytes(job).subscribe(bytesTotal => {
                Observable.from(job.requests).map((req) => {
                    return this.downloadFile(req);
                }).concatAll().subscribe((status: DownloadStatus) => {
                    if (status.state == DownloadState.SUCCESFUL) {
                        ++downloadsCompleted;
                    }
                    bytesDownloaded[status.refId] = status.bytesDownloaded;
                    observer.next({
                        jobName: job.jobName,
                        downloadsCompleted: downloadsCompleted,
                        downloadsTotal: downloadCount,
                        bytesDownloaded: this.getObjectValueSum(bytesDownloaded),
                        bytesTotal: bytesTotal,
                    });
                }, (err) => {
                    // Neccessary?
                    observer.error(err);
                }, () => {
                    // All downloads complete
                    observer.complete();
                });
            });
        });
    }
    
    getJobTotalBytes(job: DownloadJob): Observable<number> {
        //TODO: Can this start too many requests at once?
        return Observable.fromPromise(Promise.all(job.requests.map((job) => {
            return http.request({
                method: 'HEAD',
                url: job.url,
                headers: job.extraHeaders,
                timeout: 10000
            });
        })).then((responses) => responses
            .map((response) => +<string>response.headers['Content-Length'])
            .reduce((size, total) => total += size) || -1
        ));
    }
    
}
