export interface RegisterAuthUser {
  identities?: unknown[] | null;
}

export interface RegisterSignUpResult {
  data: {
    session: { user: RegisterAuthUser } | null;
    user?: RegisterAuthUser | null;
  };
  error: { message: string } | null;
}

export interface RegisterResolution {
  kind: 'error' | 'confirmation' | 'authenticated';
  errorMessage?: string;
  confirmationMessage?: string;
}

export function resolveRegisterErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
    return '该邮箱已被注册，请直接登录';
  }

  if (normalizedMessage.includes('email') && (normalizedMessage.includes('invalid') || normalizedMessage.includes('format'))) {
    return '邮箱格式不正确';
  }

  if (normalizedMessage.includes('password')) {
    return '密码强度不足，请至少6位';
  }

  return message;
}

export function resolveRegisterResult(result: RegisterSignUpResult): RegisterResolution {
  if (result.error) {
    return {
      kind: 'error',
      errorMessage: resolveRegisterErrorMessage(result.error.message),
    };
  }

  if (!result.data.session && Array.isArray(result.data.user?.identities) && result.data.user.identities.length === 0) {
    return {
      kind: 'error',
      errorMessage: '该邮箱已被注册，请直接登录',
    };
  }

  if (!result.data.session) {
    return {
      kind: 'confirmation',
      confirmationMessage: '注册成功！请前往邮箱查收确认邮件，点击链接完成验证。',
    };
  }

  return {
    kind: 'authenticated',
  };
}
