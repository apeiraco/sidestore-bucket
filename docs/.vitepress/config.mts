import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Apeiraco SideStore Bucket",
  description: "Verified iOS apps, ready for sideloading",
  base: "/",
  cleanUrls: true,
  vite: {
    resolve: { preserveSymlinks: true },
    plugins: [
      {
        name: "rewrite-repository-document-links",
        enforce: "pre",
        transform(code, id) {
          if (!id.endsWith(".md")) return null;
          const chinese = id.includes("/docs/zh/");
          return code
            .replace(/\]\(README_CN\.md\)/g, "](/zh/)")
            .replace(/\]\(README\.md\)/g, "](/)")
            .replace(/\]\(CONTRIBUTING_CN\.md\)/g, "](/zh/contributing)")
            .replace(/\]\(CONTRIBUTING\.md\)/g, "](/contributing)")
            .replace(/\]\(LICENSE\)/g, `](${chinese ? "/zh/license" : "/license"})`);
        },
      },
    ],
  },
  themeConfig: {
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/apeiraco/sidestore-bucket" }],
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: [
          { text: "Home", link: "/" },
          { text: "Apps", link: "/apps" },
          { text: "Contributing", link: "/contributing" },
          { text: "Changelog", link: "/changelog" },
        ],
        sidebar: [
          {
            items: [
              { text: "Introduction", link: "/" },
              { text: "Apps", link: "/apps" },
              { text: "Contributing", link: "/contributing" },
              { text: "Changelog", link: "/changelog" },
              { text: "License", link: "/license" },
            ],
          },
        ],
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: {
        nav: [
          { text: "首页", link: "/zh/" },
          { text: "应用", link: "/zh/apps" },
          { text: "参与贡献", link: "/zh/contributing" },
          { text: "更新日志", link: "/zh/changelog" },
        ],
        sidebar: [
          {
            items: [
              { text: "简介", link: "/zh/" },
              { text: "应用", link: "/zh/apps" },
              { text: "参与贡献", link: "/zh/contributing" },
              { text: "更新日志", link: "/zh/changelog" },
              { text: "许可证", link: "/zh/license" },
            ],
          },
        ],
      },
    },
  },
});
