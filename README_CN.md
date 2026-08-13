# 📱 Apeiraco SideStore Bucket

> _Curate Apeiraco — 精选经过验证、可供侧载的 iOS 应用。_

精选原本需要侧载用户逐一追踪的实用 iOS 版本——提供经过验证的元数据、稳定的上游下载地址与自动更新。

本项目受到 [Scoop](https://scoop.sh/) 及其声明式 bucket 自动更新模式的启发，将同样易于审查的清单与自动化方式用于 SideStore、AltStore Classic 及兼容客户端。每次更新发布前都会根据上游 IPA 中的元数据与权限进行校验。

<p class="badges">
  <a href="https://github.com/apeiraco/sidestore-bucket/actions/workflows/excavator.yml"><img src="https://github.com/apeiraco/sidestore-bucket/actions/workflows/excavator.yml/badge.svg" alt="Excavator"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Unlicense-blue" alt="License"></a>
</p>

<div class="github-only">

**[🇬🇧 English](README.md)**

</div>

## 📦 应用目录

| 应用                                                        | 说明                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| **[Tsumiru](https://github.com/Suwayomi/Suwayomi-Tsumiru)** | 支持离线下载的 Suwayomi-Server 原生漫画阅读器 |
| **[JHenTai](https://github.com/jiangtian616/JHenTai)**      | 跨平台 E-Hentai 与 ExHentai 阅读器            |
| **[HaKa Comic](https://github.com/raoxwup/haka_comic)**     | 简洁、无广告的跨平台 PicACG 客户端            |

可在[应用版本目录](https://sidestore-bucket.apeiraco.com/zh/apps)中查看当前版本与最低 iOS 要求。

## 🚀 快速开始

在 **SideStore** 或 **AltStore Classic** 中添加以下软件源地址：

```text
https://sidestore-bucket.apeiraco.com/apps.json
```

在 SideStore 中打开**软件源**，点击 **+**，粘贴地址并确认。软件源仅发布每个应用当前的稳定版本，并直接链接至开发者提供的 IPA。

## ⚠️ 使用须知

- 本软件源适用于 SideStore、AltStore Classic 及支持 AltStore 软件源格式的客户端。
- 上游发布的是未签名应用，签名与安装由侧载客户端完成。
- 部分应用可能包含成人内容，请在安装前查看对应的上游项目说明。
- IPA 来自上游发布页并经过校验，本仓库不会修改、重新签名或重新托管文件。

## 🤝 参与贡献

欢迎通过 Issue 或 Pull Request 添加应用、修正元数据或改进更新工具。修改前请阅读[贡献指南](CONTRIBUTING_CN.md)。

## 📄 许可证

[The Unlicense](LICENSE) — 公共领域

各应用仍遵循其上游项目各自的许可证与使用条款。
