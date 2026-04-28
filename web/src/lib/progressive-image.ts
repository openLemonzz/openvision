export type ProgressiveImagePriority = 'high' | 'lazy';

export function resolveProgressiveImageAttributes(priority: ProgressiveImagePriority) {
  if (priority === 'high') {
    return {
      decoding: 'async' as const,
      fetchPriority: 'high' as const,
      loading: 'eager' as const,
    };
  }

  return {
    decoding: 'async' as const,
    fetchPriority: 'low' as const,
    loading: 'lazy' as const,
  };
}

function parseAspectRatio(value: string | null | undefined) {
  const match = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(value?.trim() ?? '');
  if (!match) {
    return { width: 1, height: 1 };
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }

  return { width, height };
}

export function resolveProgressiveImageFrameStyle(
  aspectRatio: string | null | undefined,
  viewportBound?: string
) {
  const ratio = parseAspectRatio(aspectRatio);
  const style: { aspectRatio: string; width?: string } = {
    aspectRatio: `${ratio.width} / ${ratio.height}`,
  };

  if (viewportBound) {
    const multiplier = Number((ratio.width / ratio.height).toFixed(4)).toString();
    style.width = `min(100%, calc(${viewportBound} * ${multiplier}))`;
  }

  return style;
}
