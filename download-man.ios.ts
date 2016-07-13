import { Observable } from 'rxjs/Observable';

import {Common} from './download-man.common';
import {DownloadRequest, DownloadState, DownloadStatus} from './download-man.types';
export * from './download-man.types';

export class DownloadManager extends Common {
  downloadFile(request: DownloadRequest): number { return -1; }
  isDownloadInProgress(refId: number): boolean { return false; }
  getDownloadStatus(refId: number): DownloadStatus { return null; }
  getDownloadsInProgress() { return []; }
  getExternalFilesDirPath() { return ''; }
  cancelDownloads(...refIds: number[]): void {}
  cancelAllDownloads(): void {}
  destroy(): void {}

class TNSSessionDelegate extends NSObject implements NSURLSessionDelegate, NSURLSessionTaskDelegate {
  protocols: ['NSURLSessionDelegate', 'NSURLSessionTaskDelegate'];

  URLSessionDidBecomeInvalidWithError(session: NSURLSession, error: NSError): void {
    console.log(`DownloadManager.iOS - Session did become invalid callback`);
  }
	URLSessionDidReceiveChallengeCompletionHandler(session: NSURLSession, challenge: NSURLAuthenticationChallenge, completionHandler: (arg1: number, arg2: NSURLCredential) => void): void {
    console.log(`DownloadManager.iOS - Received challenge completion callback`);
  }
	URLSessionDidFinishEventsForBackgroundURLSession(session: NSURLSession): void {
    console.log(`DownloadManager.iOS - Finished events for background session`);
  }

  URLSessionTaskWillPerformHTTPRedirectionNewRequestCompletionHandler(session: NSURLSession, task: NSURLSessionTask, response: NSHTTPURLResponse, request: NSURLRequest, completionHandler: (arg1: NSURLRequest) => void): void {
    console.log(`DownloadManager.iOS - Will perform HTTP redirect`);
  }
	URLSessionTaskDidReceiveChallengeCompletionHandler(session: NSURLSession, task: NSURLSessionTask, challenge: NSURLAuthenticationChallenge, completionHandler: (arg1: number, arg2: NSURLCredential) => void): void {
    console.log(`DownloadManager.iOS - Received challenge completed`);
  }
	URLSessionTaskNeedNewBodyStream(session: NSURLSession, task: NSURLSessionTask, completionHandler: (arg1: NSInputStream) => void): void {
    console.log(`DownloadManager.iOS - New body stream`);
  }
	URLSessionTaskDidSendBodyDataTotalBytesSentTotalBytesExpectedToSend(session: NSURLSession, task: NSURLSessionTask, bytesSent: number, totalBytesSent: number, totalBytesExpectedToSend: number): void {
    console.log(`DownloadManager.iOS - Bytes sent, bytes expected to send...`);
  }
	URLSessionTaskDidCompleteWithError(session: NSURLSession, task: NSURLSessionTask, error: NSError): void {
    console.log(`DownloadManager.iOS - Did complete with error`);
  }
}