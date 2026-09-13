import UIKit
import Capacitor

/**
 * Host view controller for the Capacitor bridge.
 *
 * Capacitor only exposes `ios.webContentsDebuggingEnabled` in capacitor.config.json,
 * which is baked in at `cap sync` time and cannot tell TestFlight apart from the
 * App Store (the same archive serves both). This subclass gates the Safari Web
 * Inspector at runtime instead: Debug builds keep Capacitor's default (inspectable),
 * TestFlight builds are made inspectable, and App Store builds are left locked down.
 */
class ViewController: CAPBridgeViewController {

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()

        if Self.isTestFlight {
            descriptor.isWebDebuggable = true
        }

        return descriptor
    }

    /// TestFlight installs carry a sandbox receipt; App Store installs carry a production receipt.
    private static var isTestFlight: Bool {
        guard let receiptURL = Bundle.main.appStoreReceiptURL else {
            return false
        }

        return receiptURL.lastPathComponent == "sandboxReceipt"
    }
}
