#pragma once
#include <common.hpp>
#include <wad/index.hpp>

namespace lol::wad {
    // Brings a mod's .bin property files in line with the installed game's data layout.
    //
    // Riot changes that layout between patches (renamed shared .bin files, new required fields,
    // asset paths stored as 64-bit hashes instead of text), which breaks every mod built before the
    // change: the game either exits with "Missing data: 0x0" or renders the model untextured.
    // The expected layout is learned from the game's own .bin files in each WAD the mod overrides,
    // so nothing here is tied to a specific patch or champion.
    //
    // Returns the number of .bin files that were changed.
    auto repair_outdated_bins(Index& mod, Index const& game) -> std::size_t;
}
