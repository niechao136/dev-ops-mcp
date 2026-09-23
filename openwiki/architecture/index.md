# 文件

- [持久化与迁移](persistence.md) - DevOps MCP 如何用单一 SQLite 数据库（data/devops.db）保存持久状态、八张领域表、容器启动时运行的手写迁移脚本，以及补充数据库的进程内存存储。
- [系统总览与架构](system-overview.md) - DevOps MCP 是什么、nginx 背后的三容器拓扑、FastAPI/MCP 入口与 lifespan 启动、AI 与人类的请求路径，以及 src/ 子系统的职责划分。
- [任务执行引擎](task-execution.md) - 每次部署或重启背后的异步任务生命周期——提交、项目级锁、SSH 步骤流式写入 tasks.output_log、取消、超时与熔断、审计写入，以及 offset 轮询与 SSE 如何观察同一行。
