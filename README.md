<p align="center">
  <img src="icon.png" alt="Zushi" width="120" />
</p>

<h1 align="center">Zushi</h1>

<p align="center">
  <a href="https://github.com/Mouadzz/zushi/releases/latest"><img src="https://img.shields.io/badge/download-latest-c89b3c?style=for-the-badge" alt="Download" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-black" alt="Platform" />
  <img src="https://img.shields.io/badge/tauri-2-24C8D8" alt="Tauri" />
  <img src="https://img.shields.io/badge/react-19-61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/version-0.1.1-c89b3c" alt="Version" />
</p>

<p align="center">
  A lightweight desktop app to browse and apply League of Legends skins.
</p>

---

<p align="center">
  <img src="preview.png" alt="Zushi Preview" width="700" />
</p>

## Features

- Browse all champions and their skins with splash art previews
- Download individual skins or batch download all skins for a champion
- Select and apply multiple skins at once - one per champion
- Real-time patcher status (importing, waiting for game, skins active, etc.)
- Game auto-detection - finds your League installation automatically
- Storage management - clear downloaded skins and patcher data
- macOS native - Apple Silicon and Intel

## Installation

1. Download the latest `.dmg` for your Mac from the [Releases page](https://github.com/Mouadzz/zushi/releases/latest):
   - **Apple Silicon** (M1/M2/M3/M4/M5...) - `Zushi_x.x.x_aarch64.dmg`
   - **Intel** - `Zushi_x.x.x_x64.dmg`
2. Open the `.dmg` and drag Zushi to your Applications folder
3. On first launch, macOS may show **"Zushi is damaged and can't be opened"** - this is normal for ad-hoc signed apps. To fix this, run in Terminal:
   ```
   xattr -cr /Applications/Zushi.app
   ```
   Then open the app again normally.

## Usage

1. **Set game path** - On first launch, Zushi will automatically detect your League of Legends installation if it's in the default macOS location. If not, use the browse button to select it manually.
2. **Browse skins** - Pick a champion from the grid, then browse through all available skins with splash art previews.
3. **Download skins** - Download individual skins or batch download all skins for a champion.
4. **Apply skins** - Go to **My Skins**, select the skins you want to apply (one per champion), and click the apply button.
5. **Start your game** - Once the patcher shows "Waiting for game", you can then start your game.

> **Important:** In champion select, you must pick the **default skin** for your champion. Otherwise, your already existing skins will override the ones you chose in Zushi.

## Roadmap

- Upload and apply your own custom skins
- System tray icon to keep the app running in the background

## Analytics

Zushi collects anonymous usage data (app launches, active users) via [Umami](https://umami.is). No personal data, file paths, or identifiable information is ever collected.

## Disclaimer

Zushi is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Skins are visible only to you and do not affect gameplay or provide any competitive advantage. Use at your own risk.


## License

This project is licensed under the MIT License.

## Credits

- [cslol-manager](https://github.com/LeagueToolkit/cslol-manager) - modding tools
- [LeagueSkins](https://github.com/Alban1911/LeagueSkins) - a comprehensive collection of League of Legends skin assets, organized by champion and skin IDs
