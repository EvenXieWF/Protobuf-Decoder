# Protobuf Decoder / Protobuf 解析器
> **前提：** 需要先在电脑上安装 [Node.js](https://nodejs.org/)（它会自动包含 npm，即节点包管理器）。
>
> 如果不确定是否安装了，可以打开终端（Windows 上的 "命令提示符" 或 "PowerShell"，Mac 上的 "终端")，然后输入：
>
> ```bash
> node -v
> npm -v
> ```
>
> 
>
> 1. 在终端里 `cd` 进入项目目录
>
> 2. 运行 `npm install` 来安装所有依赖
>
> 3. 运行 `npm run dev` 来启动项目



A powerful, web-based tool to decode and analyze Protocol Buffers (Protobuf) data with or without a schema.

一个功能强大的在线工具，用于在有或没有.proto模式的情况下，解码和分析Protobuf二进制数据。

## Features / 功能

- **Flexible Input**: Supports multiple data formats including **Hexadecimal**, **Base64**, and **Decimal Bytes**. The hex parser is highly flexible, accepting data with or without spaces, commas, or `0x` prefixes. You can also upload a binary file (`.bin`, `.pb`, etc.).
- **Schema-Driven Decoding**: Use a `.proto` schema for precise field names and types.
- **Schema-less Analysis**: Intelligently decodes data based on Protobuf wire format rules even without a schema.
- **Dual View Results**: View decoded data in a detailed, structured **Table** or as a pretty-printed, interactive **JSON** object.
- **Interactive Exploration**: Recursively decode nested messages within the results table, or browse the complete structure in the JSON view with collapsible nodes.
- **Detailed Breakdowns**: View byte ranges, field numbers, wire types, and multiple interpretations of values (e.g., uint, sint, float). The JSON view shows the data path on hover.
- **Robust Error Handling**: Pinpoints the exact byte where decoding fails and displays unparsed data.

---

- **灵活输入**: 支持多种数据格式，包括**十六进制 (Hex)**、**Base64** 和**十进制字节 (Decimal Bytes)**。十六进制解析器高度灵活，可接受带或不带空格、逗号或`0x`前缀的数据。您也可以上传二进制文件（如 `.bin`, `.pb`）。
- **基于模式解码**: 提供 `.proto` 模式文件，以获得精确的字段名和类型解析。
- **无模式分析**: 即使没有模式文件，也能根据Protobuf的线路格式规则智能解码数据。
- **双视图结果**: 可以在详尽的结构化**表格**或美化、可交互的 **JSON** 对象之间切换查看结果。
- **交互式探索**: 在结果表格中，可以即时展开并解码嵌套的消息。在JSON视图中，可以通过折叠/展开节点来浏览完整的数据结构。
- **详尽解析**: 显示每个字段的字节范围、字段编号、线路类型，并提供多种数据解读（例如，`varint` 同时显示为 uint 和 sint）。JSON视图还支持在悬停时显示数据路径。
- **强大的错误处理**: 精确定位解码失败的字节，并显示剩余未解析的数据。

## How to Use / 如何使用

1.  **Input Data**: Select the appropriate format (Hexadecimal, Base64, or Decimal Bytes). Paste your data string into the "Protobuf Data" text area, or use the upload button to load a binary file.
2.  **Provide Schema (Optional)**: For more accurate results, paste your `.proto` schema definition into the "Proto Schema" area.
3.  **Decode**: Click the "Decode" button.
4.  **Analyze**: The results will be displayed below. You can switch between the "Table" and "JSON" views to analyze the output.

---

1.  **输入数据**: 选择正确的数据格式（十六进制、Base64 或十进制字节）。将您的数据字符串粘贴到 “Protobuf Data” 文本区域，或点击上传按钮加载二进制文件。
2.  **提供模式 (可选)**: 为了获得更精确的解析结果，请将您的 `.proto` 模式定义粘贴到 “Proto Schema” 区域。
3.  **解码**: 点击 “Decode” 按钮。
4.  **分析结果**: 解析结果将显示在下方。您可以在 “Table”（表格）和 “JSON” 视图之间切换以分析输出。

## Tech Stack / 技术栈

- React
- TypeScript
- Tailwind CSS

## License / 许可

This project is licensed under the MIT License.
