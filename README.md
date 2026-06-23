# SillyTavern-M

SillyTavern-M 是 SillyTavern 的多用户版本，支持多用户数据隔离和公共资源共享功能。

## 功能特点

- **多用户数据隔离**：每个用户拥有独立的聊天记录存储
- **公共API配置**：所有用户共享 `default-user` 的 API 连接配置
- **公共角色卡**：所有用户可访问系统公共角色卡目录
- **登录体验优化**：修复 Session Cookie 传递问题

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

### 访问应用

打开浏览器访问：`http://localhost:8000`

## 配置说明

确保 `config.yaml` 中已启用多用户模式：

```yaml
enableUserAccounts: true
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+), jQuery
- **后端**: Node.js, Express.js

## 原项目

本项目基于 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 开发。

## 许可证

AGPL-3.0 License