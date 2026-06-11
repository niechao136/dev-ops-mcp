
const REMEMBER = 'remember-me';
const USERNAME = 'username';

export function getRemember() {
  const remember = window?.localStorage?.getItem(REMEMBER) === 'true';
  const username = window?.localStorage?.getItem(USERNAME) ?? '';
  return { remember, username }
}

export function saveRemember(username: string) {
  if (!!username) {
    localStorage.setItem(REMEMBER, 'true');
    localStorage.setItem(USERNAME, username);
  } else {
    localStorage.removeItem(REMEMBER);
    localStorage.removeItem(USERNAME);
  }
}
