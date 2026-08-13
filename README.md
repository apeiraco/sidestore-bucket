# 📱 Apeiraco SideStore Bucket

> _Curate Apeiraco — verified iOS apps, ready for sideloading._

Curating useful iOS releases that sideloading users would otherwise track by hand — verified metadata, stable upstream downloads, and automatic updates.

This project is inspired by [Scoop](https://scoop.sh/) and its declarative bucket update model. It brings the same reviewable manifest-and-automation approach to SideStore, AltStore Classic, and compatible clients. Each update is verified against the metadata and permissions inside the upstream IPA before publication.

<p class="badges">
  <a href="https://github.com/apeiraco/sidestore-bucket/actions/workflows/excavator.yml"><img src="https://github.com/apeiraco/sidestore-bucket/actions/workflows/excavator.yml/badge.svg" alt="Excavator"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Unlicense-blue" alt="License"></a>
</p>

<div class="github-only">

**[🇨🇳 简体中文](README_CN.md)**

</div>

## 📦 App Catalog

| App                                                         | Description                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| **[Tsumiru](https://github.com/Suwayomi/Suwayomi-Tsumiru)** | A native manga and manhwa reader for Suwayomi-Server with offline downloads |
| **[JHenTai](https://github.com/jiangtian616/JHenTai)**      | A cross-platform E-Hentai and ExHentai reader                               |
| **[HaKa Comic](https://github.com/raoxwup/haka_comic)**     | A clean, ad-free, cross-platform PicACG client                              |

See the [current versions and iOS requirements](https://sidestore-bucket.apeiraco.com/apps) for release details.

## 🚀 Quick Start

Add the following source URL in **SideStore** or **AltStore Classic**:

```text
https://sidestore-bucket.apeiraco.com/apps.json
```

In SideStore, open **Sources**, tap **+**, paste the URL, and confirm. The source publishes exactly one current stable version of each app and links directly to the IPA supplied by its developer.

## ⚠️ Notes

- The source is intended for SideStore, AltStore Classic, and clients that support the AltStore source format.
- Apps are unsigned upstream releases. Your sideloading client handles signing and installation.
- Some apps may contain mature content; check each upstream project before installing.
- IPA files are verified and linked from upstream releases. They are not modified, re-signed, or rehosted here.

## 🤝 Contributing

Issues and pull requests for new apps, metadata corrections, and updater improvements are welcome. Read the [contribution guide](CONTRIBUTING.md) before making changes.

## 📄 License

[The Unlicense](LICENSE) — Public Domain

Individual apps remain subject to their respective upstream licenses and terms.
