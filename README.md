# Protobuf Decoder / Protobuf 解析器

A powerful, web-based tool to decode and analyze Protocol Buffers (Protobuf) data with or without a schema.

一个功能强大的在线工具，用于在有或没有.proto模式的情况下，解码和分析Protobuf二进制数据。

## 🚀 Quick Start / 快速开始

### Prerequisites / 前提条件

You need to have [Node.js](https://nodejs.org/) (version 16 or higher) installed on your computer. Node.js includes npm (Node Package Manager) automatically.

需要在电脑上安装 [Node.js](https://nodejs.org/)（版本 16 或更高）。Node.js 会自动包含 npm（节点包管理器）。

**Check if Node.js is installed / 检查是否已安装 Node.js:**

```bash
node -v   # Should show v16.0.0 or higher / 应显示 v16.0.0 或更高版本
npm -v    # Should show version number / 应显示版本号
```

### Installation / 安装

```bash
# 1. Clone the repository / 克隆仓库
git clone https://github.com/EvenXieWF/Protobuf-Decoder.git
cd Protobuf-Decoder/Protobuf-Decoder

# 2. Install dependencies / 安装依赖
npm install
```

### Usage Scenarios / 使用场景

#### 🔧 For Development (开发模式)

If you want to modify the code and see changes instantly:

如果你想修改代码并立即看到变化：

```bash
npm run dev
```

Open your browser and visit `http://localhost:3000`

在浏览器中访问 `http://localhost:3000`

#### 🌐 For Local Use (本地使用)

If you just want to use the tool locally without modifying code:

如果你只想在本地使用工具而不修改代码：

```bash
# 1. Build the production version / 构建生产版本
npm run build

# 2. Start the local server / 启动本地服务器
npm run preview
```

Open your browser and visit `http://localhost:4174`

在浏览器中访问 `http://localhost:4174`

#### 🚀 For Server Deployment (服务器部署)

If you want to deploy this tool to a web server:

如果你想将此工具部署到网络服务器：

```bash
# 1. Build the production version / 构建生产版本
npm run build

# 2. Deploy the 'dist' folder to your server / 将 'dist' 文件夹部署到你的服务器
# The dist folder contains all optimized files ready for production
# dist 文件夹包含所有优化过的生产就绪文件
```

**Deployment options / 部署选项:**

- **Static hosting**: Upload the `dist/` folder to services like Netlify, Vercel, GitHub Pages
- **静态托管**: 将 `dist/` 文件夹上传到 Netlify、Vercel、GitHub Pages 等服务
- **Your own server**: Use Nginx, Apache, or any static file server to serve the `dist/` folder
- **自己的服务器**: 使用 Nginx、Apache 或任何静态文件服务器来提供 `dist/` 文件夹

## Features / 功能

- **Flexible Input**: Supports multiple data formats including **Hexadecimal**, **Base64**, and **Decimal Bytes**. The hex parser is highly flexible, accepting data with or without spaces, commas, or `0x` prefixes. You can also upload a binary file (`.bin`, `.pb`, etc.).
- **Binary File Upload**: Directly upload binary Protobuf files for efficient processing without manual hex conversion.
- **Schema-Driven Decoding**: Use a `.proto` schema for precise field names and types. Supports `enum` definitions and nested messages.
- **Schema-less Analysis**: Intelligently decodes data based on Protobuf wire format rules even without a schema.
- **Dual View Results**: View decoded data in a detailed, structured **Table** or as a pretty-printed, interactive **JSON** object.
- **Export Functionality**: Export decoded results to **JSON** or **CSV** formats for further analysis.
- **Interactive Exploration**: Recursively decode nested messages within the results table, or browse the complete structure in the JSON view with collapsible nodes.
- **Detailed Breakdowns**: View byte ranges, field numbers, wire types, and multiple interpretations of values (e.g., uint, sint, float). The JSON view shows the data path on hover.
- **Robust Error Handling**: Pinpoints the exact byte where decoding fails and displays unparsed data.
- **Performance Optimized**: Uses Web Worker for asynchronous decoding to keep the UI responsive. Paginated table view handles large datasets efficiently (100 entries per page).

---

- **灵活输入**: 支持多种数据格式，包括**十六进制 (Hex)**、**Base64** 和**十进制字节 (Decimal Bytes)**。十六进制解析器高度灵活，可接受带或不带空格、逗号或`0x`前缀的数据。您也可以上传二进制文件（如 `.bin`, `.pb`）。
- **二进制文件上传**: 直接上传二进制Protobuf文件，无需手动转换为十六进制，实现高效处理。
- **基于模式解码**: 提供 `.proto` 模式文件，以获得精确的字段名和类型解析。支持 `enum` 定义和嵌套消息。
- **无模式分析**: 即使没有模式文件，也能根据Protobuf的线路格式规则智能解码数据。
- **双视图结果**: 可以在详尽的结构化**表格**或美化、可交互的 **JSON** 对象之间切换查看结果。
- **导出功能**: 将解码结果导出为 **JSON** 或 **CSV** 格式，便于进一步分析。
- **交互式探索**: 在结果表格中，可以即时展开并解码嵌套的消息。在JSON视图中，可以通过折叠/展开节点来浏览完整的数据结构。
- **详尽解析**: 显示每个字段的字节范围、字段编号、线路类型，并提供多种数据解读（例如，`varint` 同时显示为 uint 和 sint）。JSON视图还支持在悬停时显示数据路径。
- **强大的错误处理**: 精确定位解码失败的字节，并显示剩余未解析的数据。
- **性能优化**: 使用 Web Worker 进行异步解码，保持用户界面响应流畅。分页表格视图高效处理大数据集（每页100条记录）。

## How to Use / 如何使用

1. **Input Data**: Select the appropriate format (Hexadecimal, Base64, or Decimal Bytes). Paste your data string into the "Protobuf Data" text area, or use the upload button to load a binary file.
2. **Provide Schema (Optional)**: For more accurate results, paste your `.proto` schema definition into the "Proto Schema" area.
3. **Decode**: Click the "Decode" button.
4. **Analyze**: The results will be displayed below. You can switch between the "Table" and "JSON" views to analyze the output.

---

1. **输入数据**: 选择正确的数据格式（十六进制、Base64 或十进制字节）。将您的数据字符串粘贴到 “Protobuf Data” 文本区域，或点击上传按钮加载二进制文件。
2. **提供模式 (可选)**: 为了获得更精确的解析结果，请将您的 `.proto` 模式定义粘贴到 “Proto Schema” 区域。
3. **解码**: 点击 “Decode” 按钮。
4. **分析结果**: 解析结果将显示在下方。您可以在 “Table”（表格）和 “JSON” 视图之间切换以分析输出。

## Tech Stack / 技术栈

- React
- TypeScript
- Tailwind CSS
- Web Workers (for async decoding)
- Vitest (for unit testing)

## License / 许可

This project is licensed under the MIT License.
