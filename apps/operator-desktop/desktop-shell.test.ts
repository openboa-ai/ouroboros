import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Operator desktop app", () => {
  it("uses Tauri, not Electron, because desktop performance is the primary app constraint", () => {
    const rootPackageJson = JSON.parse(readFileSync(
      path.join(process.cwd(), "package.json"),
      "utf8"
    )) as {
      scripts?: Record<string, string>;
    };
    const packageJson = JSON.parse(readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "package.json"),
      "utf8"
    )) as {
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(rootPackageJson.scripts?.["dev:operator-desktop"]).toBe("npm run dev -w @ouroboros/operator-desktop");
    expect(rootPackageJson.scripts?.["package:operator-desktop"]).toBe("npm run package -w @ouroboros/operator-desktop");
    expect(rootPackageJson.scripts?.["open:operator-desktop"]).toBe(
      "node scripts/open-operator-desktop-app.mjs"
    );
    expect(rootPackageJson.scripts?.["measure:operator-performance"]).toBe(
      "node scripts/measure-operator-performance.mjs"
    );
    expect(rootPackageJson.scripts?.["verify:operator-desktop-release"]).toBe(
      "node scripts/verify-operator-desktop-release.mjs"
    );
    expect(packageJson.devDependencies).toHaveProperty("@tauri-apps/cli");
    expect(packageJson.devDependencies).not.toHaveProperty("electron");
    expect(packageJson.scripts?.build).toBe("node scripts/check-build.mjs");
    expect(packageJson.scripts?.["build:frontend"]).toBe("node scripts/build-frontend.mjs");
    expect(packageJson.scripts?.dev).toBe("tauri dev");
    expect(packageJson.scripts?.package).toBe("node scripts/package-app.mjs");
    expect(packageJson.scripts?.typecheck).toBe("npm run build");
  });

  it("keeps Linux CI from requiring macOS desktop native packaging dependencies", () => {
    const script = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "scripts", "check-build.mjs"),
      "utf8"
    );

    expect(script).toContain("OUROBOROS_OPERATOR_DESKTOP_PLATFORM");
    expect(script).toContain("glib-2.0");
    expect(script).toContain("webkit2gtk-4.1");
    expect(script).toContain("Skipping @ouroboros/operator-desktop native cargo check on Linux");
    expect(script).toContain('"cargo"');
    expect(script).toContain('"src-tauri/Cargo.toml"');
  });

  it("configures Tauri to load the shared Operator UI source through the shared runtime contract", () => {
    const config = JSON.parse(readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      build?: {
        devUrl?: string;
        frontendDist?: string;
      };
      bundle?: {
        active?: boolean;
        resources?: string[];
        targets?: string | string[];
      };
      app?: {
        windows?: Array<{
          label?: string;
          create?: boolean;
          url?: string;
          title?: string;
          width?: number;
          height?: number;
          minWidth?: number;
          minHeight?: number;
          resizable?: boolean;
          fullscreen?: boolean;
          backgroundColor?: number[];
          focus?: boolean;
          visible?: boolean;
        }>;
        security?: {
          csp?: unknown;
        };
      };
    };

    expect(config.build).toMatchObject({
      beforeDevCommand: "npm run dev -w @ouroboros/operator-web",
      beforeBuildCommand: "npm run build:frontend -w @ouroboros/operator-desktop",
      devUrl: "http://127.0.0.1:5173",
      frontendDist: "dist"
    });
    expect(config.bundle).toMatchObject({
      active: true,
      resources: [
        "resources/runtime/ouroboros-runtime",
        "resources/runtime/ouroboros-runtime.manifest.json"
      ],
      targets: ["app"]
    });
    expect(config.app?.windows).toEqual([
      {
        label: "main",
        create: true,
        url: "/index.html",
        title: "Ouroboros Operator",
        width: 1440,
        height: 960,
        minWidth: 1180,
        minHeight: 760,
        resizable: true,
        fullscreen: false,
        backgroundColor: [248, 250, 252, 255],
        focus: true,
        visible: true
      }
    ]);
    expect(config.app?.security).toMatchObject({
      csp: null
    });
  });

  it("documents Desktop-first operation with CLI parity and shared session data", () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    const architecture = readFileSync(path.join(process.cwd(), "ARCHITECTURE.md"), "utf8");
    const interfaceParity = readFileSync(
      path.join(process.cwd(), "docs", "interface-parity.md"),
      "utf8"
    );
    const desktopDoc = readFileSync(
      path.join(process.cwd(), "docs", "operator-desktop-performance-release.md"),
      "utf8"
    );

    expect(readme).toContain("Desktop app is the primary interactive operator surface");
    expect(readme).toContain("CLI remains the complete baseline");
    expect(readme).toContain("share the same runtime/store-backed session data");
    expect(architecture).toContain("primary Tauri operator app");
    expect(architecture).toContain("shared Operator UI source and browser/development surface");
    expect(interfaceParity).toContain("Desktop app: the primary interactive operator surface");
    expect(interfaceParity).toContain("CLI: the complete baseline interface");
    expect(desktopDoc).toContain("Ouroboros Desktop is the primary Tauri operator app");
    expect(desktopDoc).toContain("shared Operator UI source");
    expect(desktopDoc).toContain("currently built from `apps/operator-web`");
    expect(desktopDoc).toContain("Use `npm run open:operator-desktop` to launch the packaged app without opening a browser");
    expect(desktopDoc).not.toContain("Tauri native wrapper around Operator Web");
  });

  it("starts or reuses the existing runtime from the native Rust app", () => {
    const mainRs = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "src", "main.rs"),
      "utf8"
    );

    expect(mainRs).toContain("OUROBOROS_RUNTIME_BIN");
    expect(mainRs).toContain("bundled_runtime_executable");
    expect(mainRs).toContain('join("resources")');
    expect(mainRs).toContain("source_checkout_tsx_runtime");
    expect(mainRs).toContain('"apps/runtime/src/main.ts"');
    expect(mainRs).toContain('join(".bin")');
    expect(mainRs).toContain("TcpStream::connect_timeout");
    expect(mainRs).toContain("OUROBOROS_RUNTIME_URL");
  });

  it("creates the main operator window as a native macOS app and foregrounds it", () => {
    const mainRs = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "src", "main.rs"),
      "utf8"
    );
    const config = JSON.parse(readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "tauri.conf.json"),
      "utf8"
    )) as {
      app?: {
        windows?: Array<{ label?: string; create?: boolean; url?: string; visible?: boolean }>;
      };
    };

    expect(mainRs).toContain("ActivationPolicy::Regular");
    expect(mainRs).toContain("RunEvent::Ready");
    expect(mainRs).toContain("MAIN_WINDOW_LABEL");
    expect(mainRs).toContain("ensure_main_window(app)?");
    expect(mainRs).toContain("WebviewWindowBuilder::new");
    expect(mainRs).toContain('WebviewUrl::App("index.html".into())');
    expect(mainRs).toContain("show_main_window(app.handle())");
    expect(mainRs).toContain("app_handle.show()");
    expect(mainRs).toContain("if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL)");
    expect(mainRs).not.toContain("WebviewWindowBuilder::from_config");
    expect(mainRs).toContain("window.show()");
    expect(mainRs).toContain("window.unminimize()");
    expect(mainRs).toContain("window.set_focus()");
    expect(config.app?.windows?.[0]).toMatchObject({
      label: "main",
      create: true,
      url: "/index.html",
      visible: true
    });
  });

  it("keeps the runtime visible from the macOS menu bar while the window is hidden", () => {
    const mainRs = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "src", "main.rs"),
      "utf8"
    );

    expect(mainRs).toContain("TrayIconBuilder::with_id");
    expect(mainRs).toContain("STATUS_TRAY_ID");
    expect(mainRs).toContain('"Ouroboros RUN"');
    expect(mainRs).toContain('"Ouroboros OFF"');
    expect(mainRs).toContain("update_runtime_status_tray");
    expect(mainRs).toContain("start_runtime_status_monitor");
    expect(mainRs).toContain("ensure_runtime_running");
    expect(mainRs).toContain("restart_runtime");
    expect(mainRs).toContain("RESTART_RUNTIME_MENU_ID");
    expect(mainRs).toContain('"Restart Runtime"');
    expect(mainRs).toContain("runtime_reachable(&host, port)");
    expect(mainRs).toContain("shutdown_requested.load(Ordering::SeqCst)");
    expect(mainRs).toContain("reap_finished_runtime_child");
    expect(mainRs).toContain("WindowEvent::CloseRequested");
    expect(mainRs).toContain("api.prevent_close()");
    expect(mainRs).toContain("window.hide()");
    expect(mainRs).toContain("show_main_window");
    expect(mainRs).toContain("app_handle.exit(0)");
  });

  it("enables the Tauri tray feature without adding Electron", () => {
    const cargoToml = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "Cargo.toml"),
      "utf8"
    );

    expect(cargoToml).toContain('tauri = { version = "2", features = ["tray-icon"] }');
  });

  it("documents the packaged runtime sidecar contract", () => {
    const manifestPath = path.join(
      process.cwd(),
      "apps",
      "operator-desktop",
      "src-tauri",
      "resources",
      "runtime",
      "ouroboros-runtime.manifest.json"
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      runtime_kind?: string;
      runtime_packaging?: string;
      packaged_executable_name?: string;
      development_fallback?: string;
      authority_status?: string;
    };

    expect(manifest).toMatchObject({
      runtime_kind: "operator_runtime_sidecar",
      runtime_packaging: "source_backed_launcher",
      packaged_executable_name: "ouroboros-runtime",
      development_fallback: "source_checkout_tsx_runtime",
      authority_status: "not_live"
    });
  });

  it("verifies the runtime manifest inside the packaged app bundle", () => {
    const verifier = readFileSync(
      path.join(process.cwd(), "scripts", "verify-operator-desktop-release.mjs"),
      "utf8"
    );

    expect(verifier).toContain('"Contents"');
    expect(verifier).toContain('"Resources"');
    expect(verifier).toContain('"resources"');
    expect(verifier).toContain('"runtime"');
    expect(verifier).toContain("bundled_runtime_manifest_present");
    expect(verifier).toContain("bundled_runtime_sidecar_present");
    expect(verifier).toContain("bundled_runtime_sidecar_executable");
  });

  it("opens and measures the native Desktop app instead of a browser render by default", () => {
    const opener = readFileSync(
      path.join(process.cwd(), "scripts", "open-operator-desktop-app.mjs"),
      "utf8"
    );
    const measurement = readFileSync(
      path.join(process.cwd(), "scripts", "measure-operator-performance.mjs"),
      "utf8"
    );

    expect(opener).toContain('"Ouroboros Operator.app"');
    expect(opener).toContain('"open"');
    expect(opener).toContain("operator_desktop_open_fallback");
    expect(opener).toContain('"ouroboros-operator-desktop"');
    expect(opener).toContain("operator_desktop_app_bundle_missing");
    expect(measurement).toContain("desktop_app_render");
    expect(measurement).toContain("measureDesktopAppRender");
    expect(measurement).toContain("screencapture");
    expect(measurement).toContain("DesktopAppRenderFailure");
    expect(measurement).toContain("desktop_app_exited_before_capture");
    expect(measurement).toContain("assertDesktopAppStillRunning");
    expect(measurement).toContain("OUROBOROS_PERF_MAX_DESKTOP_APP_SCREENSHOT_MS");
    expect(measurement).not.toContain("measureBrowserRender");
    expect(measurement).not.toContain("Google Chrome");
  });

  it("ad-hoc signs the macOS app bundle after Tauri packaging for local app launch", () => {
    const packager = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "scripts", "package-app.mjs"),
      "utf8"
    );

    expect(packager).toContain('"tauri"');
    expect(packager).toContain('"build"');
    expect(packager).toContain('"codesign"');
    expect(packager).toContain('"--deep"');
    expect(packager).toContain('"--sign"');
    expect(packager).toContain('"Ouroboros Operator.app"');
  });

  it("ships a source-backed runtime sidecar launcher for packaged local app runs", () => {
    const launcherPath = path.join(
      process.cwd(),
      "apps",
      "operator-desktop",
      "src-tauri",
      "resources",
      "runtime",
      "ouroboros-runtime"
    );
    const launcher = readFileSync(launcherPath, "utf8");

    expect(launcher).toContain("#!/usr/bin/env bash");
    expect(launcher).toContain("OUROBOROS_RUNTIME_REPO_ROOT");
    expect(launcher).toContain("node_modules/.bin/tsx");
    expect(launcher).toContain("apps/runtime/src/main.ts");
    expect(launcher).toContain("operator_desktop_runtime_tsx_not_found");
    expect(launcher).toContain("operator_desktop_runtime_sidecar_repo_root_not_found");
  });

  it("keeps the shared operator-web UI source loadable from the Tauri frontendDist target", () => {
    const viteConfig = readFileSync(path.join(process.cwd(), "apps", "operator-web", "vite.config.ts"), "utf8");
    const frontendBuilder = readFileSync(
      path.join(process.cwd(), "apps", "operator-desktop", "scripts", "build-frontend.mjs"),
      "utf8"
    );

    expect(viteConfig).toContain('base: "./"');
    expect(frontendBuilder).toContain('"@ouroboros/operator-web"');
    expect(frontendBuilder).toContain('"operator-web", "dist"');
    expect(frontendBuilder).toContain('"src-tauri", "dist"');
  });

  it("ships real Tauri icon assets instead of a placeholder pixel", () => {
    const iconsDir = path.join(process.cwd(), "apps", "operator-desktop", "src-tauri", "icons");
    const iconPng = readFileSync(path.join(iconsDir, "icon.png"));
    const width = iconPng.readUInt32BE(16);
    const height = iconPng.readUInt32BE(20);

    expect(width).toBeGreaterThanOrEqual(512);
    expect(height).toBeGreaterThanOrEqual(512);
    expect(existsSync(path.join(iconsDir, "icon.icns"))).toBe(true);
    expect(existsSync(path.join(iconsDir, "icon.ico"))).toBe(true);
  });
});
