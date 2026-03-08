#!/bin/bash
set -euo pipefail

REPO="LeagueToolkit/cslol-manager"
TAG="2026-02-28-8bc5b8e"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CSLOL_DIR="$SCRIPT_DIR/cslol-tools"
TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz"
ARCHIVE_PREFIX="cslol-manager-$TAG/cslol-tools"
BINARIES_DIR="$SCRIPT_DIR/src-tauri/binaries"

# Both architectures to build
ARCHS=("arm64" "x86_64")

# Files/folders to delete (Windows-only)
DELETE_PATHS=(
    "vendor"
    "res"
    "src/main_diag.cpp"
    "src/main_wad_extract.cpp"
    "src/main_wad_extract_all.cpp"
    "src/main_wad_make.cpp"
    "lib/lol/patcher/patcher_win32.cpp"
    "lib/lol/patcher/patcher_dummy.cpp"
)

step() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
}

# --- Step 1: Check prerequisites ---
step "Checking prerequisites"
if ! command -v cmake &> /dev/null; then
    echo "ERROR: cmake not found. Install it: brew install cmake"
    exit 1
fi
echo "  cmake: $(command -v cmake)"

# --- Step 2: Download & extract ---
step "Downloading cslol-tools from tag $TAG"
if [ -d "$CSLOL_DIR" ]; then
    echo "  Removing existing $CSLOL_DIR"
    rm -rf "$CSLOL_DIR"
fi

mkdir -p "$CSLOL_DIR"
curl -L "$TARBALL_URL" | tar -xz --strip-components=2 -C "$CSLOL_DIR" "$ARCHIVE_PREFIX"

# --- Step 3: Delete Windows-only files ---
step "Removing Windows-only files"
for f in "${DELETE_PATHS[@]}"; do
    path="$CSLOL_DIR/$f"
    if [ -e "$path" ]; then
        rm -rf "$path"
        echo "  Deleted: $f"
    else
        echo "  Already gone: $f"
    fi
done

# --- Step 4: Patch CMakeLists.txt ---
step "Patching CMakeLists.txt"
CMAKE_FILE="$CSLOL_DIR/CMakeLists.txt"

# Remove individual source lines
sed -i '' '/patcher_dummy\.cpp/d' "$CMAKE_FILE"
sed -i '' '/patcher_win32\.cpp/d' "$CMAKE_FILE"

# Remove WIN32 resource block
sed -i '' '/^if (WIN32)/,/^endif()/d' "$CMAKE_FILE"

# Remove wad-extract executable block
sed -i '' '/^add_executable(wad-extract$/,/^target_link_libraries(wad-extract PRIVATE cslol-lib)$/d' "$CMAKE_FILE"

# Remove wad-extract-all executable block
sed -i '' '/^add_executable(wad-extract-all$/,/^target_link_libraries(wad-extract-all PRIVATE cslol-lib)$/d' "$CMAKE_FILE"

# Remove wad-make executable block
sed -i '' '/^add_executable(wad-make$/,/^target_link_libraries(wad-make PRIVATE cslol-lib)$/d' "$CMAKE_FILE"

echo "  CMakeLists.txt patched for macOS-only build"

# --- Step 5: Build for both architectures ---
mkdir -p "$BINARIES_DIR"
NCPU="$(sysctl -n hw.ncpu)"

for ARCH in "${ARCHS[@]}"; do
    if [ "$ARCH" = "arm64" ]; then
        TARGET_TRIPLE="aarch64-apple-darwin"
    else
        TARGET_TRIPLE="x86_64-apple-darwin"
    fi
    BINARY_DEST="$BINARIES_DIR/mod-tools-$TARGET_TRIPLE"

    step "Compiling mod-tools for $ARCH ($TARGET_TRIPLE)"
    BUILD_DIR="$CSLOL_DIR/build-$ARCH"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    cmake -S "$CSLOL_DIR" -B "$BUILD_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_OSX_ARCHITECTURES="$ARCH"
    cmake --build "$BUILD_DIR" -j"$NCPU"

    MOD_TOOLS="$BUILD_DIR/mod-tools"
    if [ ! -f "$MOD_TOOLS" ]; then
        echo "ERROR: mod-tools binary not found after $ARCH compilation"
        exit 1
    fi

    cp "$MOD_TOOLS" "$BINARY_DEST"
    chmod +x "$BINARY_DEST"
    echo "  Installed: $BINARY_DEST"
    file "$BINARY_DEST"
done

step "Done"
echo "  Binaries:"
for ARCH in "${ARCHS[@]}"; do
    if [ "$ARCH" = "arm64" ]; then
        echo "    mod-tools-aarch64-apple-darwin ($ARCH)"
    else
        echo "    mod-tools-x86_64-apple-darwin ($ARCH)"
    fi
done
