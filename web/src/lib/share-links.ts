export function buildPublicSharePath(shareCode: string) {
  return `/public/shares/${encodeURIComponent(shareCode)}`;
}

export function buildSharePageUrl(origin: string, shareCode: string) {
  return `${origin.replace(/\/+$/, '')}/#/s/${encodeURIComponent(shareCode)}`;
}

export function buildWorkshopRetryPath(inviteCode?: string | null) {
  return inviteCode ? `/?invite=${encodeURIComponent(inviteCode)}` : '/';
}

export function resolveInviteCodeFromLocation(location: Pick<Location, 'search' | 'hash'>) {
  const searchInviteCode = new URLSearchParams(location.search).get('invite');
  if (searchInviteCode) {
    return searchInviteCode;
  }

  const hashQueryStart = location.hash.indexOf('?');
  if (hashQueryStart === -1) {
    return '';
  }

  return new URLSearchParams(location.hash.slice(hashQueryStart + 1)).get('invite') || '';
}
