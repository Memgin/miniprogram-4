# getIconLibrary

云端图标库函数，返回图标清单给小程序选择器使用。

## 部署

在微信开发者工具中右键 `cloudfunctions/getIconLibrary`：
- 上传并部署：云端安装依赖

## 环境变量（可选）

- `ICON_LIBRARY_JSON`：JSON 数组字符串，覆盖默认图标库。

示例：

```json
[
  { "id": "ali_phone", "name": "手机", "category": "数码", "url": "https://你的CDN/icon-phone.png" },
  { "id": "ali_watch", "name": "手表", "category": "数码", "url": "https://你的CDN/icon-watch.png" }
]
```

建议将阿里矢量图导出为 PNG/SVG 后上传到你的 COS/CDN，再把 URL 写入该变量。
