<div align="center">
<img width="1200" height="475" alt="OpenClaw Drop Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OpenClaw Drop 🚀

端到端加密的跨设备文件传输工具

## ✨ 特性

- **端到端加密（AES-GCM）** - 使用 Web Crypto API 实现军事级加密
- **支持文本和文件传输** - 一键发送文本、图片、文档等任意文件
- **自动复制到剪贴板** - 接收文本消息自动复制，无需手动操作
- **移动端优化** - 响应式设计，完美适配手机、平板、桌面
- **深色模式** - 内置深色主题，保护视力更舒适
- **消息持久化** - 消息自动保存，刷新不丢失
- **Cloudflare Tunnel 公网部署** - 安全穿透内网，随时随地访问

## 🎯 使用场景

| 场景 | 描述 |
|------|------|
| 📱 手机 → Mac | 快速传输剪贴板内容，告别微信文件助手 |
| 💻 Mac → 手机 | 发送文件到移动设备，无需数据线 |
| 🔐 安全传输 | 传输密码、密钥等敏感信息，服务器无法查看 |
| 🌐 跨平台共享 | Windows、Mac、Linux、iOS、Android 全平台支持 |

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 公网部署

使用 Cloudflare Tunnel 将服务暴露到公网：

```bash
# 启动应用和 Tunnel
./start.sh

# 访问 https://drop.jhonsteve.com
```

## 📱 访问方式

- **本地访问**: http://localhost:3000
- **公网访问**: https://drop.jhonsteve.com

## 🔒 安全性

OpenClaw Drop 采用严格的安全设计：

- **URL Hash 存储密钥** - 加密密钥仅存储在客户端 URL #fragment 中，不会发送到服务器
- **服务器无法解密** - 服务器仅转发加密数据，无法查看内容
- **所有元数据加密** - 文件名、大小等元数据同样加密处理
- **零知识架构** - 即使服务器被攻破，用户数据依然安全

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | 前端框架 |
| TypeScript | 5.x | 类型安全 |
| Socket.IO | 4.x | 实时通信 |
| Web Crypto API | Native | 端到端加密 |
| TailwindCSS | v4 | 样式系统 |
| Cloudflare Tunnel | Latest | 内网穿透 |
| Vite | 5.x | 构建工具 |

## 📊 架构概览

```
┌─────────────┐     加密数据      ┌─────────────┐
│   Sender    │ ────────────────► │   Server    │
│  (加密端)    │                   │ (仅转发)    │
└─────────────┘                   └─────────────┘
                                         │
                                         │ 加密数据
                                         ▼
                                   ┌─────────────┐
                                   │  Receiver   │
                                   │  (解密端)    │
                                   └─────────────┘
```

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢以下开源项目：

- [Socket.IO](https://socket.io/) - 实时通信
- [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) - 内网穿透
- [TailwindCSS](https://tailwindcss.com/) - 样式系统

---

<div align="center">

**Made with ❤️ by OpenClaw**

[Report Bug](https://github.com/openclaw/drop/issues/new?template=bug_report.md) · [Request Feature](https://github.com/openclaw/drop/issues/new?template=feature_request.md)

</div>
