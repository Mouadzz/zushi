#pragma once
#include <common.hpp>
#include <fs.hpp>
#include <wad/index.hpp>

namespace lol::wad {
    // Adds the sound banks a skin lists in META/rose_sounds.json, copied out of the player's own game WADs.
    //
    // Skins packaged by Rose (LeagueSkins, patch 16.23+) load their banks from the base skin's paths
    // (Skins/Skin33/Jax_Skin33_SFX_audio.bnk -> Skins/Base/Jax_Base_SFX_audio.bnk) but do not ship the
    // game's own banks; the manifest lists them instead:
    //
    //   {"version": 1, "copies": [{"wad": "Jax", "localized": true, "from": "...", "to": "...",
    //                              "packagedLocales": []}, ...]}
    //
    // A non-localized bank is copied from <wad>.wad.client, a localized (voice) one from the locale WAD of the
    // language the client plays in, <wad>.<locale>.wad.client, unless the skin ships that language's copy
    // itself (packagedLocales). Entries are copied as the game stores them (nothing is decompressed).
    // Without this the skin plays with no sound at all.
    //
    // Never throws: a bad manifest only costs the skin its sounds. Returns the number of banks added.
    auto add_skin_sounds(Index& mod, fs::path const& mod_path, Index const& game, fs::path const& game_path)
        -> std::size_t;
}
