# Backend JAR

将你的 Spring Boot JAR 文件命名为 `light-rain-backend.jar` 放置在此目录。

## 要求

- 编译目标: JDK 17+
- JAR 为可执行格式（fat JAR）
- 确保端口可随机分配：`server.port=0` 或 Spring Boot 默认行为

## 开发环境

开发时不需要 JAR，Vite proxy 将 `/api` 转发到 `localhost:18080`。

## 生产环境

JAR 会随安装包一同分发，首次启动时自动解压到安装目录。
主进程会自动查找可用端口并启动后端。

## Spring Boot 配置建议

```yaml
# application.yml 推荐配置
server:
  port: 0                       # 随机端口，避免冲突

spring:
  application:
    name: light-rain-backend

# 健康检查端点（Electron 用它检测后端就绪）
management:
  endpoints:
    web:
      exposure:
        include: health
```
