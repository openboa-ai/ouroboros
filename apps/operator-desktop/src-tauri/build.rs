fn main() {
    watch_frontend_dist("dist");
    tauri_build::build()
}

fn watch_frontend_dist(path: &str) {
    println!("cargo:rerun-if-changed={path}");

    let Ok(entries) = std::fs::read_dir(path) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(path) = path.to_str() {
                watch_frontend_dist(path);
            }
        } else {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }
}
