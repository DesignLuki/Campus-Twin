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

城市地图采用 Natural Earth 的上海市界。地表为 [EOxCloudless](https://cloudless.eox.at/) by [EOX IT Services GmbH](https://eox.at/) (Contains modified Copernicus Sentinel data 2016 & 2017)，使用 2016 版 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 影像，经配准、裁切和调色。地表起伏来自 [Terrarium 高程瓦片](https://registry.opendata.aws/terrain-tiles/)，纵向放大显示。轮廓底座厚度和园区定位为展示设计。
