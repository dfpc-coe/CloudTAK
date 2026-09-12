import UIKit
import Capacitor
import WebKit

/**
 * Host view controller for the Capacitor bridge.
 *
 * Capacitor only exposes `ios.webContentsDebuggingEnabled` in capacitor.config.json,
 * which is baked in at `cap sync` time and cannot tell TestFlight apart from the
 * App Store (the same archive serves both). This subclass gates the Safari Web
 * Inspector at runtime instead: Debug builds keep Capacitor's default (inspectable),
 * TestFlight builds are made inspectable, and App Store builds are left locked down.
 *
 * Each bridge also gets its own WKProcessPool. WebKit caches a WebContent process
 * after its page closes and reuses it for the next WebView on the same origin from
 * the same pool - which would hand a WebView created to escape a broken content
 * process that very same process. Pools never share content processes.
 */
class ViewController: CAPBridgeViewController {

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()

        if Self.isTestFlight {
            descriptor.isWebDebuggable = true
        }

        return descriptor
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.processPool = WKProcessPool()
        return configuration
    }

    /// TestFlight installs carry a sandbox receipt; App Store installs carry a production receipt.
    private static var isTestFlight: Bool {
        guard let receiptURL = Bundle.main.appStoreReceiptURL else {
            return false
        }

        return receiptURL.lastPathComponent == "sandboxReceipt"
    }
}
