import asyncio
import os
import signal
import time
from typing import List, Tuple


async def execute_shell_script(
        command: str,
        work_dir: str,
        timeout: int = 60
) -> Tuple[bool, str, str]:
    """
    异步执行 Shell 脚本，支持超时控制、工作目录切换和日志捕获。

    返回:
        (是否成功: bool, 状态码: str, 组合日志: str)
    """

    # 检查工作目录是否存在，防患于未然
    if not os.path.isdir(work_dir):
        return False, "failed", f"执行失败: 工作目录不存在 -> {work_dir}"

    try:
        # 核心 1：创建异步子进程，并开启独立的进程组 (preexec_fn=os.setsid)
        # 为什么要独立进程组？
        # 如果脚本是 "docker-compose up && python script.py"，超时杀掉主 shell 是不够的，
        # 必须杀掉整个进程组，才能避免后台留下僵尸进程。
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=work_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=os.setsid if os.name != 'nt' else None  # Windows 系统需去掉此参数
        )

        try:
            # 核心 2：使用 asyncio.wait_for 强制超时控制
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )

            # 解码日志，遇到乱码用 ? 替换防崩溃
            stdout = stdout_bytes.decode('utf-8', errors='replace').strip()
            stderr = stderr_bytes.decode('utf-8', errors='replace').strip()

            # 合并日志，优先展示 stderr，没有则展示 stdout
            full_log = f"[STDOUT]\n{stdout}\n\n[STDERR]\n{stderr}".strip()

            is_success = process.returncode == 0
            status = "success" if is_success else "failed"

            return is_success, status, full_log

        except asyncio.TimeoutError:
            # 核心 3：触发超时，进行进程组级别的“满门抄斩”
            if os.name != 'nt':
                # 发送 SIGKILL 给整个进程组 (PGID)
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            else:
                process.kill()

            timeout_msg = f"执行超时: 脚本运行超过 {timeout} 秒被系统强制终止。\n命令: {command}"
            return False, "timeout", timeout_msg

    except Exception as e:
        return False, "failed", f"系统内部异常: {str(e)}"


async def execute_shell_commands_chain(
        commands: List[str],  # 🔴 升级为接收一个命令列表
        work_dir: str,
        total_timeout: int = 120
) -> Tuple[bool, str, str]:
    """
    异步、链式执行一组 Shell 脚本步骤。
    前一步成功才会执行下一步（天然熔断机制）。

    返回:
        (是否全部成功: bool, 状态码: str, 步骤分级日志: str)
    """
    if not os.path.isdir(work_dir):
        return False, "failed", f"执行失败: 工作目录不存在 -> {work_dir}"

    start_time = time.time()
    combined_logs = []

    # 逐个步骤跑
    for index, cmd in enumerate(commands, start=1):
        # 实时计算剩余的可用超时时间
        elapsed = time.time() - start_time
        remaining_timeout = total_timeout - elapsed

        if remaining_timeout <= 0:
            combined_logs.append(f"=== 步骤 {index}: [{cmd}] ===\n[错误]: 整体任务总时间超时，触发熔断，未执行此步骤。")
            return False, "timeout", "\n\n".join(combined_logs)

        combined_logs.append(f"=== 步骤 {index}: [{cmd}] ===")

        try:
            # 开启独立进程组
            process = await asyncio.create_subprocess_shell(
                cmd,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=os.setsid if os.name != 'nt' else None
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=remaining_timeout
                )

                stdout = stdout_bytes.decode('utf-8', errors='replace').strip()
                stderr = stderr_bytes.decode('utf-8', errors='replace').strip()

                step_log = f"[STDOUT]\n{stdout}\n[STDERR]\n{stderr}".strip()
                combined_logs.append(step_log)

                # 🔴 核心熔断判断：当前步骤失败，立刻终止后续所有步骤！
                if process.returncode != 0:
                    combined_logs.append(
                        f"❌ 步骤 {index} 执行失败 (Exit Code: {process.returncode})，后续流程已自动熔断拦截。")
                    return False, "failed", "\n\n".join(combined_logs)

            except asyncio.TimeoutError:
                # 满门抄斩僵尸进程
                if os.name != 'nt':
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                else:
                    process.kill()

                combined_logs.append(f"❌ 步骤 {index} 运行超时被强杀。后续流程已自动终止。")
                return False, "timeout", "\n\n".join(combined_logs)

        except Exception as e:
            combined_logs.append(f"❌ 系统内部异常: {str(e)}")
            return False, "failed", "\n\n".join(combined_logs)

    return True, "success", "\n\n".join(combined_logs)
