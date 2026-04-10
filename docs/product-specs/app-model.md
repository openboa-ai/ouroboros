# App Model

- AutoKairos should ship as an installable local app.
- The app should feel alive when opened.
- The desktop client stack should use:
  - `Tauri 2`
  - `React`
  - `Vite`
  - `Tailwind CSS`
  - `shadcn/ui`-oriented primitives
- The app should expose:
  - real-time dashboard
  - mode status
  - provider connection status
  - intervention controls
  - reasoning and change-history drill-downs
- The official client should talk to a service/application layer rather than reading the strategy workspace directly.
- The app should start in `observer` or `paper`, not `live`.
- The app should remain compatible with later headless or server deployment.
