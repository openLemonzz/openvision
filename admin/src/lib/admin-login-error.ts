export function getAdminLoginErrorMessage(error: unknown) {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : String(error);

  if (message === 'Invalid login credentials') {
    return '邮箱或密码错误';
  }

  return `登录失败：${message}`;
}
