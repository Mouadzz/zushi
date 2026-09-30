#include <error.hpp>
#include <hash/xxh64.hpp>
#include <io/file.hpp>
#include <wad/repair.hpp>

#include <algorithm>
#include <cstring>
#include <optional>
#include <regex>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

using namespace lol;
using namespace lol::wad;

namespace {
    enum : std::uint8_t {
        T_STRING = 0x10,
        T_HASH = 0x11,
        T_FILE = 0x12,
        T_LIST = 0x80,
        T_LIST2 = 0x81,
        T_POINTER = 0x82,
        T_EMBED = 0x83,
        T_LINK = 0x84,
        T_OPTION = 0x85,
        T_MAP = 0x86,
        T_FLAG = 0x87,
    };

    constexpr auto raw_size(std::uint8_t type) noexcept -> std::size_t {
        switch (type) {
            case 1:
            case 2:
            case 3:
            case T_FLAG:
                return 1;
            case 4:
            case 5:
                return 2;
            case 6:
            case 7:
            case 10:
            case 15:
                return 4;
            case 8:
            case 9:
            case 11:
                return 8;
            case 12:
                return 12;
            case 13:
                return 16;
            case 14:
                return 64;
            default:
                return 0;
        }
    }

    struct Field;

    struct Node {
        std::uint8_t type = 0;
        std::string raw;            // fixed-size payloads and string bytes
        std::uint64_t num = 0;      // hash, link, file
        std::uint8_t elem = 0;      // list/option element type, map value type
        std::uint8_t key = 0;       // map key type
        std::uint32_t cls = 0;      // pointer/embed class; 0 is a null pointer
        std::vector<Node> items;    // list items, option value, map keys and values interleaved
        std::vector<Field> fields;  // pointer/embed fields
    };

    struct Field {
        std::uint32_t name = 0;
        Node value;
    };

    struct Object {
        std::uint32_t cls = 0;
        std::uint32_t path = 0;
        std::vector<Field> fields;
    };

    struct PropFile {
        std::uint32_t version = 0;
        std::vector<std::string> links;
        std::vector<Object> objects;
        std::string tail;
    };

    struct ParseError : std::runtime_error {
        using std::runtime_error::runtime_error;
    };

    struct Reader {
        char const* cur;
        char const* end;

        auto need(std::size_t count) -> void {
            if ((std::size_t)(end - cur) < count) throw ParseError("truncated .bin");
        }

        template <typename T>
        auto num() -> T {
            need(sizeof(T));
            T value;
            std::memcpy(&value, cur, sizeof(T));
            cur += sizeof(T);
            return value;
        }

        auto bytes(std::size_t count) -> std::string {
            need(count);
            auto result = std::string(cur, count);
            cur += count;
            return result;
        }

        auto fields() -> std::vector<Field> {
            auto result = std::vector<Field>(num<std::uint16_t>());
            for (auto& field : result) {
                field.name = num<std::uint32_t>();
                field.value = value(num<std::uint8_t>());
            }
            return result;
        }

        auto value(std::uint8_t type) -> Node {
            auto node = Node{.type = type};
            switch (type) {
                case T_STRING:
                    node.raw = bytes(num<std::uint16_t>());
                    break;
                case T_HASH:
                case T_LINK:
                    node.num = num<std::uint32_t>();
                    break;
                case T_FILE:
                    node.num = num<std::uint64_t>();
                    break;
                case T_LIST:
                case T_LIST2:
                    node.elem = num<std::uint8_t>();
                    num<std::uint32_t>();
                    node.items.resize(num<std::uint32_t>());
                    for (auto& item : node.items) item = value(node.elem);
                    break;
                case T_POINTER:
                case T_EMBED:
                    if ((node.cls = num<std::uint32_t>())) {
                        num<std::uint32_t>();
                        node.fields = fields();
                    }
                    break;
                case T_OPTION:
                    node.elem = num<std::uint8_t>();
                    if (num<std::uint8_t>()) node.items.push_back(value(node.elem));
                    break;
                case T_MAP: {
                    node.key = num<std::uint8_t>();
                    node.elem = num<std::uint8_t>();
                    num<std::uint32_t>();
                    auto const count = num<std::uint32_t>();
                    for (std::uint32_t i = 0; i != count; ++i) {
                        node.items.push_back(value(node.key));
                        node.items.push_back(value(node.elem));
                    }
                    break;
                }
                default:
                    if (auto const size = raw_size(type)) {
                        node.raw = bytes(size);
                    } else {
                        throw ParseError(fmt::format("unknown .bin value type {:#x}", type));
                    }
            }
            return node;
        }
    };

    struct Writer {
        std::string out;

        template <typename T>
        auto num(T value) -> void {
            out.append((char const*)&value, sizeof(T));
        }

        auto size_slot() -> std::size_t {
            num<std::uint32_t>(0);
            return out.size() - sizeof(std::uint32_t);
        }

        auto fill_size(std::size_t slot) -> void {
            auto const size = (std::uint32_t)(out.size() - slot - sizeof(std::uint32_t));
            std::memcpy(out.data() + slot, &size, sizeof(size));
        }

        auto fields(std::vector<Field> const& fields) -> void {
            num((std::uint16_t)fields.size());
            for (auto const& field : fields) {
                num(field.name);
                num(field.value.type);
                value(field.value);
            }
        }

        auto value(Node const& node) -> void {
            switch (node.type) {
                case T_STRING:
                    num((std::uint16_t)node.raw.size());
                    out += node.raw;
                    break;
                case T_HASH:
                case T_LINK:
                    num((std::uint32_t)node.num);
                    break;
                case T_FILE:
                    num((std::uint64_t)node.num);
                    break;
                case T_LIST:
                case T_LIST2: {
                    num(node.elem);
                    auto const slot = size_slot();
                    num((std::uint32_t)node.items.size());
                    for (auto const& item : node.items) value(item);
                    fill_size(slot);
                    break;
                }
                case T_POINTER:
                case T_EMBED:
                    num(node.cls);
                    if (node.cls) {
                        auto const slot = size_slot();
                        fields(node.fields);
                        fill_size(slot);
                    }
                    break;
                case T_OPTION:
                    num(node.elem);
                    num((std::uint8_t)node.items.size());
                    for (auto const& item : node.items) value(item);
                    break;
                case T_MAP: {
                    num(node.key);
                    num(node.elem);
                    auto const slot = size_slot();
                    num((std::uint32_t)(node.items.size() / 2));
                    for (auto const& item : node.items) value(item);
                    fill_size(slot);
                    break;
                }
                default:
                    out += node.raw;
            }
        }
    };

    auto parse(std::string_view data) -> PropFile {
        auto reader = Reader{data.data(), data.data() + data.size()};
        if (reader.bytes(4) != "PROP") throw ParseError("not a PROP file");
        auto file = PropFile{.version = reader.num<std::uint32_t>()};
        if (file.version >= 2) {
            file.links.resize(reader.num<std::uint32_t>());
            for (auto& link : file.links) link = reader.bytes(reader.num<std::uint16_t>());
        }
        auto classes = std::vector<std::uint32_t>(reader.num<std::uint32_t>());
        for (auto& cls : classes) cls = reader.num<std::uint32_t>();
        for (auto const cls : classes) {
            auto const size = reader.num<std::uint32_t>();
            reader.need(size);
            auto sub = Reader{reader.cur, reader.cur + size};
            auto object = Object{.cls = cls, .path = sub.num<std::uint32_t>()};
            object.fields = sub.fields();
            if (sub.cur != sub.end) throw ParseError("object size mismatch");
            reader.cur = sub.end;
            file.objects.push_back(std::move(object));
        }
        file.tail.assign(reader.cur, reader.end);
        return file;
    }

    auto serialize(PropFile const& file) -> std::string {
        auto writer = Writer{};
        writer.out += "PROP";
        writer.num(file.version);
        if (file.version >= 2) {
            writer.num((std::uint32_t)file.links.size());
            for (auto const& link : file.links) {
                writer.num((std::uint16_t)link.size());
                writer.out += link;
            }
        }
        writer.num((std::uint32_t)file.objects.size());
        for (auto const& object : file.objects) writer.num(object.cls);
        for (auto const& object : file.objects) {
            auto const slot = writer.size_slot();
            writer.num(object.path);
            writer.fields(object.fields);
            writer.fill_size(slot);
        }
        writer.out += file.tail;
        return std::move(writer.out);
    }

    // Decompressed contents of an entry, if it is a PROP file (patch files, PTCH, are left alone).
    auto prop_bytes(EntryData const& data) -> std::optional<std::string> {
        try {
            if (data.extension() != ".bin") return std::nullopt;
            auto const bytes = data.into_decompressed().bytes();
            auto view = std::string_view(bytes.data(), bytes.size());
            if (!view.starts_with("PROP")) return std::nullopt;
            return std::string(view);
        } catch (std::exception const&) {
            error::stack().clear();
            return std::nullopt;
        }
    }

    template <typename Fields, typename Visit>
    auto walk(Fields& fields, std::uint32_t owner, Visit& visit) -> void;

    template <typename N, typename Visit>
    auto walk_node(N& node, Visit& visit) -> void {
        if ((node.type == T_POINTER || node.type == T_EMBED) && node.cls) {
            walk(node.fields, node.cls, visit);
        }
        for (auto& item : node.items) walk_node(item, visit);
    }

    template <typename Fields, typename Visit>
    auto walk(Fields& fields, std::uint32_t owner, Visit& visit) -> void {
        for (auto& field : fields) {
            visit(owner, field);
            walk_node(field.value, visit);
        }
    }

    enum : std::uint8_t { AS_NONE = 0, AS_TEXT = 1, AS_FILE_HASH = 2 };

    // How a field stores asset paths: as text or as 64-bit file hashes, directly or in a list/option.
    auto path_storage(Node const& node) -> std::uint8_t {
        auto type = node.type;
        if (type == T_LIST || type == T_LIST2 || type == T_OPTION) type = node.elem;
        return type == T_STRING ? AS_TEXT : type == T_FILE ? AS_FILE_HASH : AS_NONE;
    }

    auto to_file_hashes(Node& node) -> void {
        if (node.type == T_STRING) {
            node.type = T_FILE;
            node.num = hash::Xxh64(node.raw);
            node.raw.clear();
            return;
        }
        node.elem = T_FILE;
        for (auto& item : node.items) to_file_hashes(item);
    }

    constexpr auto owner_key(std::uint32_t owner, std::uint32_t field) noexcept -> std::uint64_t {
        return ((std::uint64_t)owner << 32) | field;
    }

    // What the installed game's own .bin files look like, learned from one WAD.
    struct Layout {
        std::unordered_map<std::uint64_t, std::uint8_t> storage_by_owner;
        std::unordered_map<std::uint32_t, std::uint8_t> storage_by_name;
        // Classes whose every object carries a hash field set to the object's own path hash.
        std::unordered_map<std::uint32_t, std::uint32_t> self_id_field;

        static auto learn(Archive const& stock) -> Layout {
            auto layout = Layout{};
            auto objects_of_class = std::unordered_map<std::uint32_t, std::size_t>{};
            auto self_ids = std::unordered_map<std::uint64_t, std::size_t>{};
            auto record = [&layout](std::uint32_t owner, Field const& field) {
                if (auto const storage = path_storage(field.value)) {
                    layout.storage_by_owner[owner_key(owner, field.name)] |= storage;
                    layout.storage_by_name[field.name] |= storage;
                }
            };
            for (auto const& [name, data] : stock.entries) {
                auto const bytes = prop_bytes(data);
                if (!bytes) continue;
                auto file = PropFile{};
                try {
                    file = parse(*bytes);
                } catch (ParseError const&) {
                    continue;
                }
                for (auto& object : file.objects) {
                    ++objects_of_class[object.cls];
                    for (auto const& field : object.fields) {
                        if (field.value.type == T_HASH && field.value.num == object.path) {
                            ++self_ids[owner_key(object.cls, field.name)];
                        }
                    }
                    walk(object.fields, object.cls, record);
                }
            }
            for (auto const& [key, count] : self_ids) {
                auto const cls = (std::uint32_t)(key >> 32);
                if (count == objects_of_class[cls]) layout.self_id_field.emplace(cls, (std::uint32_t)key);
            }
            return layout;
        }

        auto wants_file_hash(std::uint32_t owner, std::uint32_t field) const -> bool {
            if (auto i = storage_by_owner.find(owner_key(owner, field)); i != storage_by_owner.end()) {
                if (i->second == AS_FILE_HASH) return true;
            }
            auto i = storage_by_name.find(field);
            return i != storage_by_name.end() && i->second == AS_FILE_HASH;
        }
    };

    // Shared .bin files were renamed from DATA/<Champ>_Skins_... to
    // DATA/Characters/<Champ>/<Champ>_Multi_Skins_...
    auto renamed_shared_bin(std::string const& path) -> std::optional<std::string> {
        static auto const pattern = std::regex(R"(^DATA/([^/]+?)_Skins_(.+)$)", std::regex::icase);
        auto match = std::smatch{};
        if (!std::regex_match(path, match, pattern)) return std::nullopt;
        auto const champ = match[1].str();
        return "DATA/Characters/" + champ + "/" + champ + "_Multi_Skins_" + match[2].str();
    }

    template <typename Exists>
    auto repair(PropFile& file, Layout const& layout, Exists const& exists) -> std::size_t {
        auto changes = std::size_t{};

        for (auto& link : file.links) {
            if (exists(link)) continue;
            if (auto renamed = renamed_shared_bin(link); renamed && exists(*renamed)) {
                link = std::move(*renamed);
                ++changes;
            }
        }

        for (auto& object : file.objects) {
            auto const self_id = layout.self_id_field.find(object.cls);
            if (self_id == layout.self_id_field.end()) continue;
            auto const has_self_id = std::any_of(object.fields.begin(), object.fields.end(), [&](Field const& field) {
                return field.name == self_id->second;
            });
            if (!has_self_id) {
                object.fields.push_back(Field{.name = self_id->second, .value = Node{.type = T_HASH, .num = object.path}});
                ++changes;
            }
        }

        auto convert = [&layout, &changes](std::uint32_t owner, Field& field) {
            if (path_storage(field.value) == AS_TEXT && layout.wants_file_hash(owner, field.name)) {
                to_file_hashes(field.value);
                ++changes;
            }
        };
        for (auto& object : file.objects) walk(object.fields, object.cls, convert);

        return changes;
    }
}

auto wad::repair_outdated_bins(Index& mod, Index const& game) -> std::size_t {
    lol_trace_func(lol_trace_var("{}", mod.name));
    auto layouts = std::unordered_map<std::string, Layout>{};
    auto known_paths = std::unordered_set<std::uint64_t>{};
    auto exists = [&known_paths](std::string const& path) {
        return known_paths.contains(hash::Xxh64(path));
    };
    auto repaired = std::size_t{};

    for (auto& [mount_name, mounted] : mod.mounts) {
        auto const base = game.find_by_mount_name_or_overlap(mount_name, mounted.archive);
        if (!base) continue;

        for (auto& [name, data] : mounted.archive.entries) {
            auto const bytes = prop_bytes(data);
            if (!bytes) continue;

            auto file = PropFile{};
            try {
                file = parse(*bytes);
            } catch (ParseError const& e) {
                logw("Skipping unreadable .bin {:#016x} in {}: {}", (std::uint64_t)name, mod.name, e.what());
                continue;
            }
            if (serialize(file) != *bytes) {
                logw("Skipping .bin {:#016x} in {}: unsupported layout", (std::uint64_t)name, mod.name);
                continue;
            }

            if (known_paths.empty()) {
                for (auto const* index : {&game, (Index const*)&mod}) {
                    for (auto const& [other_name, other] : index->mounts) {
                        for (auto const& [path, entry] : other.archive.entries) known_paths.insert(path);
                    }
                }
            }
            auto layout = layouts.find(base->name());
            if (layout == layouts.end()) {
                layout = layouts.emplace(base->name(), Layout::learn(base->archive)).first;
            }

            if (repair(file, layout->second, exists)) {
                auto const out = serialize(file);
                data = EntryData::from_raw(io::Bytes::from_vector(std::vector<char>(out.begin(), out.end())), 0);
                ++repaired;
            }
        }
    }
    return repaired;
}
