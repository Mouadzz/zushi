cmake_minimum_required(VERSION 3.20)

project(mod-tools LANGUAGES C CXX)

cmake_policy(SET CMP0169 OLD)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_subdirectory(dep)

add_library(mod-tools-lib STATIC
    lib/common.cpp
    lib/common.hpp
    lib/error.cpp
    lib/error.hpp
    lib/fs.cpp
    lib/fs.hpp
    lib/log.hpp
    lib/log.cpp

    lib/hash/dict.cpp
    lib/hash/dict.hpp
    lib/hash/fnv1a32.cpp
    lib/hash/fnv1a32.hpp
    lib/hash/xxh64.cpp
    lib/hash/xxh64.hpp

    lib/io/buffer.hpp
    lib/io/buffer.cpp
    lib/io/bytes.cpp
    lib/io/bytes.hpp
    lib/io/file.cpp
    lib/io/file.hpp
    lib/io/sys.cpp
    lib/io/sys.hpp

    lib/patcher/patcher.hpp
    lib/patcher/patcher_macos_amd64.cpp
    lib/patcher/patcher_macos_arm64.cpp
    lib/patcher/utility/delay.hpp
    lib/patcher/utility/macho.hpp
    lib/patcher/utility/process.hpp
    lib/patcher/utility/process_macos.cpp

    lib/utility/cli.hpp
    lib/utility/cli.cpp
    lib/utility/magic.cpp
    lib/utility/magic.hpp
    lib/utility/zip.cpp
    lib/utility/zip.hpp

    lib/wad/archive.cpp
    lib/wad/archive.hpp
    lib/wad/mounted.hpp
    lib/wad/mounted.cpp
    lib/wad/entry.cpp
    lib/wad/entry.hpp
    lib/wad/index.cpp
    lib/wad/index.hpp
    lib/wad/toc.cpp
    lib/wad/toc.hpp
)

target_compile_definitions(mod-tools-lib PUBLIC -D_CRT_SECURE_NO_WARNINGS)
target_link_libraries(mod-tools-lib PUBLIC fmt fmtlog)
target_link_libraries(mod-tools-lib PRIVATE libdeflate zstd xxhash miniz)
target_include_directories(mod-tools-lib PUBLIC lib/)

add_executable(mod-tools main.cpp)
target_link_libraries(mod-tools PRIVATE mod-tools-lib)
