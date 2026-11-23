#include <error.hpp>
#include <hash/xxh64.hpp>
#include <log.hpp>
#include <wad/skin_sounds.hpp>

#include <algorithm>
#include <cctype>
#include <fstream>
#include <iterator>
#include <optional>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <vector>

using namespace lol;
using namespace lol::wad;

namespace {
    constexpr auto MANIFEST = "rose_sounds.json";

    auto lower(std::string str) -> std::string {
        std::transform(str.begin(), str.end(), str.begin(), [](unsigned char c) { return (char)std::tolower(c); });
        return str;
    }

    auto read_text(fs::path const& path) -> std::optional<std::string> {
        auto file = std::ifstream(path, std::ios::binary);
        if (!file) return std::nullopt;
        return std::string(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
    }

    // Just enough JSON for the manifest.
    struct Json {
        enum Kind { Null, Bool, Number, String, Array, Object } kind = Null;
        bool boolean = false;
        double number = 0;
        std::string string;
        std::vector<Json> array;
        std::vector<std::pair<std::string, Json>> object;

        auto get(std::string_view key) const -> Json const* {
            for (auto const& [name, value] : object)
                if (name == key) return &value;
            return nullptr;
        }

        auto get_string(std::string_view key) const -> std::optional<std::string> {
            auto const value = get(key);
            if (!value || value->kind != String) return std::nullopt;
            return value->string;
        }

        auto get_bool(std::string_view key) const -> bool {
            auto const value = get(key);
            return value && value->kind == Bool && value->boolean;
        }
    };

    struct JsonParser {
        char const* cur;
        char const* end;

        [[noreturn]] static auto fail(char const* what) -> void { throw std::runtime_error(what); }

        auto skip_ws() -> void {
            while (cur != end && (*cur == ' ' || *cur == '\t' || *cur == '\n' || *cur == '\r')) ++cur;
        }

        auto expect(char c) -> void {
            skip_ws();
            if (cur == end || *cur != c) fail("malformed JSON");
            ++cur;
        }

        auto literal(std::string_view word) -> void {
            if ((std::size_t)(end - cur) < word.size() || std::string_view(cur, word.size()) != word) {
                fail("malformed JSON literal");
            }
            cur += word.size();
        }

        auto hex4() -> std::uint32_t {
            if (end - cur < 4) fail("truncated JSON escape");
            auto value = std::uint32_t{};
            for (int i = 0; i != 4; ++i) {
                auto const c = *cur++;
                value <<= 4;
                if (c >= '0' && c <= '9') value |= (std::uint32_t)(c - '0');
                else if (c >= 'a' && c <= 'f') value |= (std::uint32_t)(c - 'a' + 10);
                else if (c >= 'A' && c <= 'F') value |= (std::uint32_t)(c - 'A' + 10);
                else fail("bad JSON escape");
            }
            return value;
        }

        static auto put_utf8(std::string& out, std::uint32_t cp) -> void {
            if (cp < 0x80) {
                out += (char)cp;
            } else if (cp < 0x800) {
                out += (char)(0xC0 | (cp >> 6));
                out += (char)(0x80 | (cp & 0x3F));
            } else if (cp < 0x10000) {
                out += (char)(0xE0 | (cp >> 12));
                out += (char)(0x80 | ((cp >> 6) & 0x3F));
                out += (char)(0x80 | (cp & 0x3F));
            } else {
                out += (char)(0xF0 | (cp >> 18));
                out += (char)(0x80 | ((cp >> 12) & 0x3F));
                out += (char)(0x80 | ((cp >> 6) & 0x3F));
                out += (char)(0x80 | (cp & 0x3F));
            }
        }

        auto string() -> std::string {
            expect('"');
            auto out = std::string{};
            for (;;) {
                if (cur == end) fail("unterminated JSON string");
                auto const c = *cur++;
                if (c == '"') return out;
                if (c != '\\') {
                    out += c;
                    continue;
                }
                if (cur == end) fail("unterminated JSON string");
                switch (auto const e = *cur++) {
                    case '"': out += '"'; break;
                    case '\\': out += '\\'; break;
                    case '/': out += '/'; break;
                    case 'b': out += '\b'; break;
                    case 'f': out += '\f'; break;
                    case 'n': out += '\n'; break;
                    case 'r': out += '\r'; break;
                    case 't': out += '\t'; break;
                    case 'u': {
                        auto cp = hex4();
                        if (cp >= 0xD800 && cp <= 0xDBFF && end - cur >= 6 && cur[0] == '\\' && cur[1] == 'u') {
                            cur += 2;
                            auto const low = hex4();
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
                        }
                        put_utf8(out, cp);
                        break;
                    }
                    default: fail("bad JSON escape");
                }
            }
        }

        auto value(int depth = 0) -> Json {
            if (depth > 64) fail("JSON nested too deep");
            skip_ws();
            if (cur == end) fail("truncated JSON");
            auto result = Json{};
            switch (*cur) {
                case '{':
                    result.kind = Json::Object;
                    ++cur;
                    skip_ws();
                    if (cur != end && *cur == '}') {
                        ++cur;
                        return result;
                    }
                    for (;;) {
                        auto key = string();
                        expect(':');
                        result.object.emplace_back(std::move(key), value(depth + 1));
                        skip_ws();
                        if (cur != end && *cur == ',') {
                            ++cur;
                            continue;
                        }
                        expect('}');
                        return result;
                    }
                case '[':
                    result.kind = Json::Array;
                    ++cur;
                    skip_ws();
                    if (cur != end && *cur == ']') {
                        ++cur;
                        return result;
                    }
                    for (;;) {
                        result.array.push_back(value(depth + 1));
                        skip_ws();
                        if (cur != end && *cur == ',') {
                            ++cur;
                            continue;
                        }
                        expect(']');
                        return result;
                    }
                case '"':
                    result.kind = Json::String;
                    result.string = string();
                    return result;
                case 't':
                    literal("true");
                    result.kind = Json::Bool;
                    result.boolean = true;
                    return result;
                case 'f':
                    literal("false");
                    result.kind = Json::Bool;
                    return result;
                case 'n':
                    literal("null");
                    return result;
                default: {
                    auto const start = cur;
                    while (cur != end && (std::isdigit((unsigned char)*cur) || *cur == '-' || *cur == '+' ||
                                          *cur == '.' || *cur == 'e' || *cur == 'E')) {
                        ++cur;
                    }
                    if (cur == start) fail("malformed JSON");
                    result.kind = Json::Number;
                    result.number = std::strtod(std::string(start, cur).c_str(), nullptr);
                    return result;
                }
            }
        }

        static auto parse(std::string_view text) -> Json {
            if (text.starts_with("\xEF\xBB\xBF")) text.remove_prefix(3);
            auto parser = JsonParser{text.data(), text.data() + text.size()};
            auto result = parser.value();
            parser.skip_ws();
            if (parser.cur != parser.end) fail("trailing data after JSON");
            return result;
        }
    };

    struct SoundCopy {
        std::string wad;
        bool localized = false;
        std::string from;
        std::string to;
        std::vector<std::string> packaged_locales;  // lower case
    };

    auto read_copies(fs::path const& manifest_path) -> std::vector<SoundCopy> {
        auto result = std::vector<SoundCopy>{};
        auto const text = read_text(manifest_path);
        if (!text) return result;
        auto const manifest = JsonParser::parse(*text);
        if (manifest.kind != Json::Object) throw std::runtime_error("manifest is not an object");
        auto const version = manifest.get("version");
        if (!version || version->kind != Json::Number || version->number != 1) {
            throw std::runtime_error("unknown manifest version");
        }
        auto const copies = manifest.get("copies");
        if (!copies || copies->kind != Json::Array) return result;
        for (auto const& item : copies->array) {
            if (item.kind != Json::Object) continue;
            auto wad = item.get_string("wad");
            auto from = item.get_string("from");
            auto to = item.get_string("to");
            if (!wad || !from || !to || wad->empty()) continue;
            auto copy = SoundCopy{
                .wad = std::move(*wad),
                .localized = item.get_bool("localized"),
                .from = std::move(*from),
                .to = std::move(*to),
            };
            if (auto const packaged = item.get("packagedLocales"); packaged && packaged->kind == Json::Array) {
                for (auto const& locale : packaged->array) {
                    if (locale.kind == Json::String) copy.packaged_locales.push_back(lower(locale.string));
                }
            }
            result.push_back(std::move(copy));
        }
        return result;
    }

    auto is_locale(std::string_view str) -> bool {
        return str.size() == 5 && str[2] == '_' && std::isalpha((unsigned char)str[0]) &&
               std::isalpha((unsigned char)str[1]) && std::isalpha((unsigned char)str[3]) &&
               std::isalpha((unsigned char)str[4]);
    }

    // The language the client launches the game in (pt_BR...), from the settings it writes next to the game:
    // <LoL>/Config/LeagueClientSettings.yaml, "globals:" -> "locale:". Lower case; empty when unknown.
    auto client_locale(fs::path game_path) -> std::string {
        if (game_path.filename().empty()) game_path = game_path.parent_path();
        auto const text = read_text(game_path.parent_path() / "Config" / "LeagueClientSettings.yaml");
        if (!text) return {};
        static auto const pattern = std::regex(
            R"re((?:^|\n)[ \t]+globals:[ \t]*\r?\n(?:[ \t]+[\w-]+:.*\r?\n)*?[ \t]+locale:[ \t]*"?([A-Za-z]{2}_[A-Za-z]{2}))re");
        auto match = std::smatch{};
        if (!std::regex_search(*text, match, pattern)) return {};
        return lower(match[1].str());
    }

    // The game mount names (lower case, e.g. "jax.pt_br") of the locale WADs of *wad*.
    auto locale_mounts(Index const& game, std::string const& wad) -> std::vector<std::string> {
        auto result = std::vector<std::string>{};
        auto const prefix = wad + ".";
        for (auto const& [name, mounted] : game.mounts) {
            if (!name.starts_with(prefix)) continue;
            if (!mounted.relpath.generic_string().ends_with(".wad.client")) continue;
            if (is_locale(std::string_view(name).substr(prefix.size()))) result.push_back(name);
        }
        return result;
    }
}

auto wad::add_skin_sounds(Index& mod, fs::path const& mod_path, Index const& game, fs::path const& game_path)
    -> std::size_t {
    auto copies = std::vector<SoundCopy>{};
    try {
        copies = read_copies(mod_path / "META" / MANIFEST);
    } catch (std::exception const& e) {
        error::stack().clear();
        logw("Skin sounds of {} skipped: META/{}: {}", mod.name, MANIFEST, e.what());
        return 0;
    }
    if (copies.empty()) return 0;

    auto locale = std::optional<std::string>{};  // resolved lazily, only for localized banks
    auto added = std::size_t{};
    auto missing = std::size_t{};
    for (auto const& copy : copies) {
        auto const wad = lower(copy.wad);
        auto mount_name = wad;
        if (copy.localized) {
            if (!locale) locale = client_locale(game_path);
            auto const candidates = locale_mounts(game, wad);
            mount_name.clear();
            if (!locale->empty()) {
                if (auto const i = std::find(candidates.begin(), candidates.end(), wad + "." + *locale);
                    i != candidates.end()) {
                    mount_name = *i;
                }
            } else if (candidates.size() == 1) {
                // Without the client's language, only a lone locale WAD is surely the one the game reads
                mount_name = candidates.front();
            }
            if (mount_name.empty()) {
                logw("Skin sounds of {}: no locale WAD of {} for the client's language ({})",
                     mod.name,
                     copy.wad,
                     locale->empty() ? "unknown" : *locale);
                ++missing;
                continue;
            }
            auto const mount_locale = mount_name.substr(wad.size() + 1);
            if (std::find(copy.packaged_locales.begin(), copy.packaged_locales.end(), mount_locale) !=
                copy.packaged_locales.end()) {
                continue;  // the skin ships this language's copy itself
            }
        }

        auto const source = game.find_by_mount_name(mount_name);
        if (!source) {
            logw("Skin sounds of {}: game WAD {} not found", mod.name, mount_name);
            ++missing;
            continue;
        }
        auto const entry = source->archive.entries.find(hash::Xxh64(copy.from));
        if (entry == source->archive.entries.end()) {
            logw("Skin sounds of {}: {} not in {}", mod.name, copy.from, source->relpath.filename());
            ++missing;
            continue;
        }

        auto target = mod.mounts.find(mount_name);
        if (target == mod.mounts.end()) {
            target = mod.mounts.emplace(mount_name, Mounted{fs::path("WAD") / source->relpath.filename(), Archive{}})
                         .first;
        }
        // A bank the skin ships itself (patched) wins over the game's copy
        if (target->second.archive.entries.try_emplace(hash::Xxh64(copy.to), entry->second).second) {
            ++added;
        }
    }

    if (added) logi("Added {} skin sound bank(s) from the game to {}", added, mod.name);
    if (missing) logw("Skin sounds of {}: {} bank(s) could not be copied", mod.name, missing);
    return added;
}
