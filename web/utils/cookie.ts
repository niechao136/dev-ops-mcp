import Cookies from 'js-cookie';


export function setCookie(key: string, value: string, option: Cookies.CookieAttributes = {}) {
  Cookies.set(key, value, option);
}

export function getClientCookie(key: string) {
  return Cookies.get(key);
}

export async function getServerCookie(key: string) {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return cookieStore.get(key)?.value;
}

export async function getCookie(key: string) {
  if (typeof window === 'undefined') {
    // 服务端环境
    return await getServerCookie(key);
  }

  // 客户端环境
  return getClientCookie(key);
}

export function removeCookie(key: string, option: Cookies.CookieAttributes = {}) {
  Cookies.remove(key, option);
}


const TOKEN_COOKIE = 'dev-ops-bot-token';

export function saveToken(token: string) {
  setCookie(TOKEN_COOKIE, token, { expires: 1, path: '/' });
}

export function clearToken() {
  removeCookie(TOKEN_COOKIE);
}

export async function getToken() {
  return await getCookie(TOKEN_COOKIE) ?? '';
}


const THEME_MODE = 'theme-mode';

export function saveMode(mode: string) {
  setCookie(THEME_MODE, mode, { expires: 1, path: '/' });
}

export function getClientMode() {
  if (typeof window === 'undefined') return 'dark';
  const mode = getClientCookie(THEME_MODE);
  return mode === 'light' ? 'light' : 'dark';
}

export async function getServerMode() {
  const mode = await getServerCookie(THEME_MODE);
  return mode === 'light' ? 'light' : 'dark';
}
