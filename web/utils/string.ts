import { PageParams } from '@/types/api';


export function stringToColor(string: string) {
  let hash = 0;
  let i;

  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';
  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    // 限制颜色亮度，确保首字母白字能看清
    const safeValue = Math.floor(value * 0.8);
    color += `00${safeValue.toString(16)}`.slice(-2);
  }

  return color;
}


export function getAvatarText(name: string) {
  if (!name) return '?';
  // 如果是英文名取第一个字母大写，如果是中文名取第一个字
  const firstChar = name.trim().charAt(0);
  return firstChar.toUpperCase();
}


export function getParams(params?: PageParams) {
  if (!params) return '';

  const filtered = Object.entries(params || {})
    .filter(([k, v]) => !!k && !!v && !!String(v).trim())
    .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {});

   const query = new URLSearchParams(filtered).toString();

   return !!query ? `?${query}` : '';
}


export async function copyToClipboard(text: string) {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API 失败，尝试降级方案', err);
  }

  // 降级方案：创建临时 textarea 执行复制
  let res = true;
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    res = document.execCommand('copy');
  } catch (err) {
    console.warn('document.execCommand 失败：', err);
    res = false;
  } finally {
    document.body.removeChild(textArea);
  }
  return res;
}
