#pragma once

#include <functional>
#include <common.hpp>
#include <fs.hpp>

namespace lol::patcher {
    /// Writes one diagnostic line to stderr, which Zushi captures and echoes.
    void patch_log(char const* fmt, ...) noexcept __attribute__((format(printf, 1, 2)));

    /// Resumes a game frozen by Process::Suspend(). Call from a termination
    /// handler: a suspend count outlives the process that took it, so dying
    /// mid-patch would otherwise leave the game frozen for good.
    void emergency_resume() noexcept;

    enum Message {
        M_WAIT_START,
        M_FOUND,
        M_WAIT_INIT,
        M_SCAN,
        M_NEED_SAVE,
        M_WAIT_PATCHABLE,
        M_PATCH,
        M_WAIT_EXIT,
        M_DONE,
        M_COUNT_OF,
    };

    static constexpr const char* const STATUS_MSG[Message::M_COUNT_OF] = {
        "Waiting for league match to start",
        "Found League",
        "Wait initialized",
        "Scanning",
        "Saving",
        "Wait patchable",
        "Patching",
        "Waiting for exit",
        "League exited",
    };

    extern auto run(std::function<void(Message, char const*)> update,
                    fs::path const& profile_path,
                    fs::path const& config_path,
                    fs::path const& game_path,
                    fs::names const& opts) -> void;

    struct PatcherTimeout : std::runtime_error {
        using std::runtime_error::runtime_error;
    };

    struct PatcherAborted : std::runtime_error {
        PatcherAborted() : std::runtime_error("Aborted as expected") {}
    };
}
