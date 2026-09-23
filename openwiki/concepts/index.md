# 文件

- [自动化规则与调度器](automation.md) - cron 与 condition 自动化规则如何存储、校验，如何经 APScheduler 或 asyncio 检查循环按 UTC 调度，条件脚本的全行 exit-0 语义，以及以 actor_type=automation 提交并带 last_run 反馈的触发路径。
- [项目、命令与模板](projects-and-commands.md) - Web 控制台与 MCP 工具背后的共享领域模型——带工作目录的项目、带 ${param} 占位符与确认/健康标志的命令、默认参数与调用参数的合并顺序，以及可导入的公共命令模板。
- [安全与授权模型](security.md) - 分层控制模型——MCP 的 API 密钥 scope 与项目白名单、控制台的 JWT 角色、两段式确认令牌、bcrypt/Fernet 凭据处理、审计归属，以及经 devops 用户与 sudo 白名单的宿主机最小权限。
