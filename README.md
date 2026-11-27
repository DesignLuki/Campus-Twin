# 智慧数字孪生可视化园区

[打开三维预览](https://designluki.github.io/smart-campus-digital-twin/)

桌面浏览器需支持 WebGL 2。首次访问会加载 A、B、C 三栋楼的模型，合计约 49 MB。

打开「空间导航」，选择 A 楼、9F、A-903 会议室。在右侧选择设备，再点击「独立查看」和「拆开设备」查看内部结构。园区包含 248 个空间和 176 个设备点位，展示数据为模拟样本。

## 本地运行

使用 Node.js 24，在项目目录运行以下命令。

```sh
npm ci
npm run dev
```

## 发布

向 main 推送更新后，GitHub Actions 会运行测试并构建静态站点，随后部署到 GitHub Pages。工作流位于 `.github/workflows/pages.yml`。

城市视图使用 Natural Earth 公有领域的市界和[主要道路数据](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/roads/)。建筑群和园区位置用于场景演示，定位卡统计当前模型中的空间和设备。
