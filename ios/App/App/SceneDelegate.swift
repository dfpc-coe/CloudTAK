import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private let restartAfterBackgroundSeconds: TimeInterval = 30
    private var backgroundedAt: Date?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // UIKit normally builds the window from Main.storyboard (UISceneStoryboardFile), which
        // instantiates our ViewController subclass. Only build one by hand if that didn't happen.
        if window == nil {
            window = UIWindow(windowScene: windowScene)
            window?.rootViewController = ViewController()
            window?.makeKeyAndVisible()
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        backgroundedAt = Date()
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        guard let backgroundedAt else { return }
        self.backgroundedAt = nil

        if Date().timeIntervalSince(backgroundedAt) < restartAfterBackgroundSeconds { return }

        // Not a reload: a reload keeps the WebContent process and its IndexedDB connection,
        // either of which iOS may have broken while we were backgrounded. Load the app in a
        // fresh WebView - a fresh content process - the same path a cold start takes.
        guard let window,
              let fresh = UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController() else {
            return
        }

        window.rootViewController = fresh
    }
}
