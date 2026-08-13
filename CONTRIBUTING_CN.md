# 参与贡献

你可以通过贡献添加应用、修正元数据、改进校验逻辑或完善文档。请让软件源保持精简、可复现并易于审查。

<div class="github-only">

**[🇬🇧 English](CONTRIBUTING.md)**

</div>

## 开发环境

安装 [mise](https://mise.jdx.dev/)，然后准备仓库：

```sh
mise trust
mise install
mise exec -- just setup
```

在非交互式 shell 中请通过 mise 运行项目命令。GitHub API 可在公开限额内匿名使用；需要更高限额时可设置 `GH_TOKEN` 或 `GITHUB_TOKEN`。

## 添加或更新应用

应用清单位于 `bucket/*.json`。请参考现有清单，并提供：

- 应用身份信息及英文说明；
- 从实际 IPA 验证得到的 bundle identifier；
- 上游 GitHub 仓库；
- 仅匹配一个 IPA 的完整锚定资源正则表达式；
- 以精确上游标签为键的英文 `releaseNotes`，用于提供有意义的版本说明。

如果标签没有对应的版本说明，更新器会生成简短的英文版本更新提示。更新清单时请删除已经失效的版本说明条目。

使用以下命令检查并生成元数据：

```sh
mise exec -- just checkver
mise exec -- just update --app <app-slug>
mise exec -- just check
mise exec -- just build-docs
```

请审查应用身份、版本、构建号、最低 iOS 版本、权限、下载地址及 SHA-256 的变化。不要执行下载的应用代码。

## 生成文件

`bucket.lock.json`、`apps.json`、`docs/apps.md` 和 `docs/zh/apps.md` 由 CLI 生成，请勿直接修改。下载文件和实验内容应放在已忽略的 `temp/` 目录中。

`bucket.lock.json` 是经过验证的产物记录，并非另一份应用清单。它保存准确的 release 与 asset ID、API 返回的下载地址、IPA 身份、版本、构建号、最低 iOS 版本、权限、大小和 SHA-256。借助这些信息，软件源与文档无需访问 GitHub 或重新下载 IPA 即可确定性构建，同时也能将清单修改和已验证产物修改分开审查。

软件源为每个应用保留一个稳定版本。更新器使用 Octokit 选择最新的 GitHub 稳定发布，保留 API 返回的下载地址，检查 IPA，并仅在所有选中产物通过校验后写入受版本控制的文件。

## 提交检查

开发环境的 mise 配置跟随兼容的主版本或次版本，`mise.ci.toml` 则固定 CI 使用的完整工具链版本。运行一次 `mise exec -- prek install` 即可启用仓库的提交前检查。`prek` 会检查 JSON、TOML、YAML、软链接、生成文件、bucket 与锁文件的一致性、TypeScript、格式、测试以及本地文档链接。

## Pull Request

应用清单与生成文件应在同一项修改中提交。发起 Pull Request 前运行：

```sh
mise exec -- just check
mise exec -- just build-docs
```

请说明用户可见的变化，并明确指出新增或改变的权限。不要提交下载的 IPA、凭据、VitePress 构建产物或无关的格式化修改。
