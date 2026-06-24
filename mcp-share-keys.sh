#!/bin/bash
# =====================================================================
#  SSH 密钥安全共享与自动授权脚本
#  用法: sudo bash mcp-share-keys.sh [源用户] [目标用户]
#  示例: sudo bash mcp-share-keys.sh root devops
# =====================================================================

set -e  # 遇到错误立即退出

# 颜色输出定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 1. 权限检查
[[ $EUID -ne 0 ]] && error "请使用 root 权限运行此脚本: sudo bash $0 ..."

# 2. 参数解析与校验
SRC_USER="${1:-root}"
DST_USER="${2:-devops}"

if ! id "${SRC_USER}" &>/dev/null; then
    error "源用户 '${SRC_USER}' 不存在，请检查输入。"
fi

if ! id "${DST_USER}" &>/dev/null; then
    error "目标用户 '${DST_USER}' 不存在，请先创建该用户。"
fi

# 3. 获取用户的 Home 目录
SRC_HOME=$(eval echo "~${SRC_USER}")
DST_HOME=$(eval echo "~${DST_USER}")

SRC_SSH_DIR="${SRC_HOME}/.ssh"
DST_SSH_DIR="${DST_HOME}/.ssh"

info "启动密钥共享流程: [${SRC_USER}] ──> [${DST_USER}]"

# 4. 检查源用户是否存在密钥
if [[ ! -d "${SRC_SSH_DIR}" ]]; then
    error "未找到源用户 '${SRC_USER}' 的 .ssh 目录 (${SRC_SSH_DIR})。"
fi

# 5. 创建目标用户的 .ssh 目录
if [[ ! -d "${DST_SSH_DIR}" ]]; then
    info "正在创建目标用户 '${DST_USER}' 的 .ssh 目录..."
    mkdir -p "${DST_SSH_DIR}"
fi

# 6. 批量复制密钥文件 (支持 rsa, ed25519, ecdsa, dsa)
info "正在复制有效的 SSH 密钥及配置文件..."
KEY_FOUND=false

# 定义常见的密钥文件名模式
for key_pattern in id_rsa id_ed25519 id_ecdsa id_dsa config known_hosts; do
    # 查找匹配的文件（包括公钥 .pub）
    for file in $(find "${SRC_SSH_DIR}" -maxdepth 1 -name "${key_pattern}*" 2>/dev/null); do
        filename=$(basename "${file}")
        cp "${file}" "${DST_SSH_DIR}/${filename}"
        KEY_FOUND=true
    done
done

if [ "$KEY_FOUND" = false ]; then
    warn "在 ${SRC_SSH_DIR} 中未发现任何标准 SSH 密钥或指纹文件。"
fi

# 7. 自动补充主流 Git 平台的信任指纹（双重保障防止卡死）
info "正在优化主流 Git 平台（GitHub/GitLab）的 known_hosts 指纹记录..."
touch "${DST_SSH_DIR}/known_hosts"
for domain in github.com gitlab.com gitee.com; do
    if ! grep -qF "${domain}" "${DST_SSH_DIR}/known_hosts" 2>/dev/null; then
        ssh-keyscan -t ed25519,rsa "${domain}" >> "${DST_SSH_DIR}/known_hosts" 2>/dev/null || true
    fi
done

# 8. 核心安全：修正目标目录的 Linux 物理权限与所有者
info "正在修正权限与文件所有者 (chown & chmod)..."
chown -R "${DST_USER}:${DST_USER}" "${DST_SSH_DIR}"
chmod 700 "${DST_SSH_DIR}"
# 确保私钥是 600，公钥和 known_hosts 可以是 644 或 600
find "${DST_SSH_DIR}" -type f -name "id_*" ! -name "*.pub" -exec chmod 600 {} +
find "${DST_SSH_DIR}" -type f -name "*.pub" -exec chmod 644 {} +
[[ -f "${DST_SSH_DIR}/config" ]] && chmod 600 "${DST_SSH_DIR}/config"
[[ -f "${DST_SSH_DIR}/known_hosts" ]] && chmod 644 "${DST_SSH_DIR}/known_hosts"

# 9. 最终连通性验证
info "正在以 '${DST_USER}' 身份验证与 GitHub 的连通性..."
set +e # 允许验证命令失败而不退出脚本
TEST_RESULT=$(su - "${DST_USER}" -c "ssh -T -o ConnectTimeout=5 git@github.com 2>&1")

if echo "${TEST_RESULT}" | grep -qE "(Hi |successfully authenticated)"; then
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN} ✅ 密钥共享成功！'${DST_USER}' 现已成功获得 GitHub 访问权限。${NC}"
    echo -e "${GREEN}====================================================${NC}"
else
    echo -e "${YELLOW}====================================================${NC}"
    echo -e "${YELLOW} ⚠️  密钥已复制并处理权限，但 GitHub 连通性测试未完全通过。${NC}"
    echo -e "${YELLOW} 原因可能是源用户本身未绑定该 GitHub，或网络超时。${NC}"
    echo -e " 提示输出: ${TEST_RESULT}"
    echo -e "${YELLOW}====================================================${NC}"
fi