fn main() {
    tauri_build::build();

    // Embed Info.plist in the Mach-O binary so macOS Authorization Services
    // recognise this as a proper app (required for AuthorizationCreate).
    if cfg!(target_os = "macos") {
        let plist = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("Info.plist");
        println!(
            "cargo:rustc-link-arg=-sectcreate"
        );
        println!("cargo:rustc-link-arg=__TEXT");
        println!("cargo:rustc-link-arg=__info_plist");
        println!(
            "cargo:rustc-link-arg={}",
            plist.display()
        );
    }
}
