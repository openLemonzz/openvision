type DownloadAnchor = {
  href: string;
  download: string;
  rel: string;
  click: () => void;
};

type DownloadImageDeps = {
  fetchImage?: (url: string) => Promise<Response>;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  createAnchor?: () => DownloadAnchor;
  appendAnchor?: (anchor: DownloadAnchor) => void;
  removeAnchor?: (anchor: DownloadAnchor) => void;
  openUrl?: (url: string) => void;
};

export type DownloadImageOutcome = 'downloaded' | 'opened' | 'failed';

export async function downloadImageFromUrl(
  url: string,
  downloadName: string,
  deps: DownloadImageDeps = {},
): Promise<DownloadImageOutcome> {
  const fetchImage = deps.fetchImage ?? ((imageUrl: string) => fetch(imageUrl));
  const createObjectUrl = deps.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl = deps.revokeObjectUrl ?? ((objectUrl: string) => URL.revokeObjectURL(objectUrl));
  const createAnchor = deps.createAnchor ?? (() => document.createElement('a'));
  const appendAnchor = deps.appendAnchor ?? ((anchor: DownloadAnchor) => document.body.appendChild(anchor as HTMLAnchorElement));
  const removeAnchor = deps.removeAnchor ?? ((anchor: DownloadAnchor) => document.body.removeChild(anchor as HTMLAnchorElement));
  const openUrl = deps.openUrl ?? ((imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  });

  try {
    const response = await fetchImage(url);
    if (!response.ok) {
      throw new Error(`Image download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = createObjectUrl(blob);
    const anchor = createAnchor();
    anchor.href = objectUrl;
    anchor.download = downloadName;
    anchor.rel = 'noopener';

    let appended = false;
    try {
      appendAnchor(anchor);
      appended = true;
      anchor.click();
    } finally {
      if (appended) {
        removeAnchor(anchor);
      }
      revokeObjectUrl(objectUrl);
    }

    return 'downloaded';
  } catch {
    try {
      openUrl(url);
      return 'opened';
    } catch {
      return 'failed';
    }
  }
}
