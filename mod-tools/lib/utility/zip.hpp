#pragma once
#include <common.hpp>
#include <fs.hpp>

namespace lol::utility {
    extern auto zip(fs::path const& src, fs::path const& dst) -> void;
    extern auto unzip(fs::path const& src, fs::path const& dst) -> void;
}
