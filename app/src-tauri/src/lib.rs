use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::{DownloadEvent, NewWindowResponse, PermissionKind, PermissionResponse};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";

fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" | "data" => true,
        "http" | "https" => {
            matches!(url.host_str(), Some("tauri.localhost"))
                || (cfg!(dev) && matches!(url.host_str(), Some("localhost")))
        }
        _ => false,
    }
}

fn open_external(app: &AppHandle, url: &Url) {
    if !matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
        return;
    }

    if let Err(err) = app.opener().open_url(url.as_str(), None::<&str>) {
        eprintln!("failed to open {url}: {err}");
    }
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

// Dropping all site data forgets the stored server URL and session, so the
// reloaded app lands back on the Setup page.
fn change_server(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };

    if let Err(err) = window.clear_all_browsing_data() {
        eprintln!("failed to clear browsing data: {err}");
    }

    let _ = window.eval("window.location.replace('/setup.html')");
}

// WebKitGTK has no setting for pinch-to-zoom, so its zoom gesture is detached.
#[cfg(target_os = "linux")]
fn disable_pinch_zoom(window: &WebviewWindow) {
    use gtk::glib::{gobject_ffi, ObjectExt};

    let _ = window.with_webview(|webview| unsafe {
        if let Some(gesture) = webview.inner().data::<gtk::GestureZoom>("wk-view-zoom-gesture") {
            gobject_ffi::g_signal_handlers_destroy(gesture.as_ptr().cast());
        }
    });
}

#[cfg(not(target_os = "linux"))]
fn disable_pinch_zoom(_window: &WebviewWindow) {}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let file = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("change-server", "Change Server URL").build(app)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("quit", "Quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?,
        )
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("devtools", "Toggle Developer Tools")
                .accelerator("CmdOrCtrl+Shift+I")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("zoom-reset", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    MenuBuilder::new(app).items(&[&file, &edit, &view]).build()
}

fn on_menu(app: &AppHandle, id: &str, zoom: &std::sync::Mutex<f64>) {
    let Some(window) = main_window(app) else { return };

    let set_zoom = |next: f64| {
        let mut zoom = zoom.lock().unwrap();
        *zoom = next.clamp(0.5, 3.0);
        let _ = window.set_zoom(*zoom);
    };

    match id {
        "change-server" => change_server(app),
        "quit" => app.exit(0),
        "reload" => {
            let _ = window.eval("window.location.reload()");
        }
        "devtools" => {
            if window.is_devtools_open() {
                window.close_devtools();
            } else {
                window.open_devtools();
            }
        }
        "zoom-reset" => set_zoom(1.0),
        "zoom-in" => {
            let current = *zoom.lock().unwrap();
            set_zoom(current + 0.1);
        }
        "zoom-out" => {
            let current = *zoom.lock().unwrap();
            set_zoom(current - 0.1);
        }
        _ => {}
    }
}

pub fn run() {
    let zoom = std::sync::Mutex::new(1.0_f64);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .menu(build_menu)
        .on_menu_event(move |app, event| on_menu(app, event.id().as_ref(), &zoom))
        .setup(|app| {
            let handle = app.handle().clone();
            let nav_handle = handle.clone();

            let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
                .title("CloudTAK")
                .inner_size(1200.0, 800.0)
                .min_inner_size(480.0, 480.0)
                .on_navigation(move |url| {
                    if is_app_url(url) {
                        return true;
                    }

                    open_external(&nav_handle, url);
                    false
                })
                .on_new_window(move |url, _features| {
                    open_external(&handle, &url);
                    NewWindowResponse::Deny
                })
                .on_permission_request(|_webview, kind| match kind {
                    PermissionKind::Geolocation
                    | PermissionKind::Notifications
                    | PermissionKind::Camera
                    | PermissionKind::Microphone => PermissionResponse::Allow,
                    _ => PermissionResponse::Default,
                })
                .on_download(|webview, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        let name = destination.file_name().map(|name| name.to_owned());
                        if let (Ok(dir), Some(name)) = (webview.path().download_dir(), name) {
                            *destination = dir.join(name);
                        }
                    }

                    true
                })
                .build()?;

            disable_pinch_zoom(&window);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CloudTAK");
}
