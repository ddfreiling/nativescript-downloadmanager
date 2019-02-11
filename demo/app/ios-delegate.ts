import { ios } from "tns-core-modules/application";
class MyDelegate extends UIResponder implements UIApplicationDelegate {
  public static ObjCProtocols = [UIApplicationDelegate];

  applicationDidFinishLaunchingWithOptions(application: UIApplication, launchOptions: NSDictionary<string, any>): boolean {
    console.log("applicationWillFinishLaunchingWithOptions: " + launchOptions);

    return true;
  }

  applicationDidBecomeActive(application: UIApplication): void {
    console.log("applicationDidBecomeActive: " + application);
  }

  applicationHandleEventsForBackgroundURLSessionCompletionHandler?(application: UIApplication, identifier: string, completionHandler: () => void): void {
    console.log("applicationHandleEventsForBackgroundURLSessionCompletionHandler");
  }
}
ios.delegate = MyDelegate;