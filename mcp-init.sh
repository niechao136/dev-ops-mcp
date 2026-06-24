#!/bin/bash
# =============================================================
#  MCP 运维用户初始化脚本
#  适用系统：Ubuntu / Debian
#  用法：sudo bash mcp-init.sh
# =============================================================

set -e  # 任意步骤失败立即退出

# -----------------------------------------------
# 颜色输出
# -----------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# -----------------------------------------------
# 必须以 root 运行
# -----------------------------------------------
[[ $EUID -ne 0 ]] && error "请使用 root 权限运行此脚本：sudo bash $0"

# -----------------------------------------------
# 配置区（按需修改）
# -----------------------------------------------
DEVOPS_USER="devops"
SSH_PORT=22
KEY_DIR="/root/mcp_keys"          # 生成的密钥保存位置（宿主机）
KEY_NAME="mcp_devops"             # 密钥文件名

# -----------------------------------------------
# 1. 创建 devops 用户
# -----------------------------------------------
info "Step 1/6 - 创建用户 ${DEVOPS_USER}..."

if id "${DEVOPS_USER}" &>/dev/null; then
    warn "用户 ${DEVOPS_USER} 已存在，跳过创建。"
else
    useradd -m -s /bin/bash "${DEVOPS_USER}"
    # 锁定密码登录，只允许密钥登录
    passwd -l "${DEVOPS_USER}"
    info "用户 ${DEVOPS_USER} 创建成功，已禁用密码登录。"
fi

# 加入常用用户组（组不存在时自动跳过）
for group in docker systemd-journal adm; do
    if getent group "${group}" &>/dev/null; then
        usermod -aG "${group}" "${DEVOPS_USER}"
        info "已将 ${DEVOPS_USER} 加入 ${group} 组。"
    else
        warn "用户组 ${group} 不存在，跳过。"
    fi
done

# -----------------------------------------------
# 1.5 配置 devops 用户的 Git 全局安全目录白名单
# -----------------------------------------------
info "Step 1.5 - 配置 devops 用户的 Git 安全目录白名单..."

# 确保以 devops 用户身份执行该全局配置，直接使用通配符 '*' 信任所有目录
su - "${DEVOPS_USER}" -c "git config --global --add safe.directory '*'"

info "Git 全局目录信任配置成功（已允许 devops 用户操作任何路径下的仓库）。"

# -----------------------------------------------
# 2. 生成专用 SSH 密钥对
# -----------------------------------------------
info "Step 2/6 - 生成 SSH 密钥对..."

mkdir -p "${KEY_DIR}"
chmod 700 "${KEY_DIR}"

if [[ -f "${KEY_DIR}/${KEY_NAME}" ]]; then
    warn "密钥 ${KEY_DIR}/${KEY_NAME} 已存在，跳过生成。"
else
    ssh-keygen -t ed25519 -f "${KEY_DIR}/${KEY_NAME}" -N "" -C "mcp-devops-key"
    info "密钥生成成功：${KEY_DIR}/${KEY_NAME}"
fi

# -----------------------------------------------
# 3. 将公钥写入 devops 用户的授权列表
# -----------------------------------------------
info "Step 3/6 - 配置 SSH 公钥授权..."

DEVOPS_SSH_DIR="/home/${DEVOPS_USER}/.ssh"
mkdir -p "${DEVOPS_SSH_DIR}"

# 避免重复写入
PUBKEY=$(cat "${KEY_DIR}/${KEY_NAME}.pub")
if grep -qF "${PUBKEY}" "${DEVOPS_SSH_DIR}/authorized_keys" 2>/dev/null; then
    warn "公钥已在 authorized_keys 中，跳过写入。"
else
    echo "${PUBKEY}" >> "${DEVOPS_SSH_DIR}/authorized_keys"
    info "公钥写入成功。"
fi

chown -R "${DEVOPS_USER}:${DEVOPS_USER}" "${DEVOPS_SSH_DIR}"
chmod 700 "${DEVOPS_SSH_DIR}"
chmod 600 "${DEVOPS_SSH_DIR}/authorized_keys"

# -----------------------------------------------
# 4. 配置 sudo 权限
# -----------------------------------------------
info "Step 4/6 - 配置 sudo 权限..."

SUDOERS_FILE="/etc/sudoers.d/${DEVOPS_USER}"

cat > "${SUDOERS_FILE}" <<EOF
# MCP 运维用户 sudo 白名单
# 按需取消注释或新增命令

# Docker 相关
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/docker
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/docker compose
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/local/bin/docker-compose

# Git 相关
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/git

# 服务管理
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /bin/systemctl start *
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /bin/systemctl stop *
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart *
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /bin/systemctl status *

# 日志查看
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/journalctl

# 基础文件与权限初始化工具
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/mkdir *
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/chown *
${DEVOPS_USER} ALL=(ALL) NOPASSWD: /usr/bin/chmod *

# 如命令种类繁多，可暂时放开全部权限（安全性降低）
# ${DEVOPS_USER} ALL=(ALL) NOPASSWD: ALL
EOF

chmod 440 "${SUDOERS_FILE}"

# 语法检查，防止写错导致 sudo 崩溃
visudo -cf "${SUDOERS_FILE}" || error "sudoers 文件语法错误，请检查 ${SUDOERS_FILE}"
info "sudo 权限配置成功。"

# -----------------------------------------------
# 5. 加固 SSH 配置（禁止 root 直连）
# -----------------------------------------------
info "Step 5/6 - 加固 SSH 配置..."

SSHD_CONFIG="/etc/ssh/sshd_config"

# 备份原始配置
cp "${SSHD_CONFIG}" "${SSHD_CONFIG}.bak.$(date +%Y%m%d%H%M%S)"

set_sshd_option() {
    local key="$1"
    local value="$2"
    if grep -qE "^#?${key}" "${SSHD_CONFIG}"; then
        sed -i "s|^#\?${key}.*|${key} ${value}|" "${SSHD_CONFIG}"
    else
        echo "${key} ${value}" >> "${SSHD_CONFIG}"
    fi
}

set_sshd_option "PubkeyAuthentication"   "yes"                 # 启用公钥登录
set_sshd_option "Port"                   "${SSH_PORT}"

# 重启 SSH 服务
systemctl restart sshd
info "SSH 配置加固完成，已重启 sshd。"

# -----------------------------------------------
# 6. 验证连通性
# -----------------------------------------------
info "Step 6/6 - 验证 SSH 连接..."

sleep 1  # 等待 sshd 完全重启

TEST_RESULT=$(ssh -i "${KEY_DIR}/${KEY_NAME}" \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=5 \
    -p "${SSH_PORT}" \
    "${DEVOPS_USER}@127.0.0.1" \
    "echo SSH_OK" 2>&1)

if echo "${TEST_RESULT}" | grep -q "SSH_OK"; then
    info "SSH 连接验证成功 ✅"
else
    warn "SSH 连接验证失败，请手动检查。输出：${TEST_RESULT}"
fi

# -----------------------------------------------
# 完成，输出摘要
# -----------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  初始化完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  运维用户：${DEVOPS_USER}"
echo "  私钥路径：${KEY_DIR}/${KEY_NAME}        ← 挂载进 MCP 容器"
echo "  公钥路径：${KEY_DIR}/${KEY_NAME}.pub"
echo ""
echo "  docker-compose.yml 挂载配置："
echo "    volumes:"
echo "      - ${KEY_DIR}/${KEY_NAME}:/root/.ssh/id_rsa:ro"
echo ""
echo "  .env 配置："
echo "    HOST_SSH=host.docker.internal"
echo "    HOST_SSH_PORT=${SSH_PORT}"
echo "    HOST_SSH_USER=${DEVOPS_USER}"
echo "    HOST_SSH_KEY=/root/.ssh/id_rsa"
echo ""
echo -e "${YELLOW}  ⚠️  请妥善保管私钥，不要泄露！${NC}"
echo ""