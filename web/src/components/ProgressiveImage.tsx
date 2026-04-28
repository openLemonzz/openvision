import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import {
  resolveProgressiveImageAttributes,
  resolveProgressiveImageFrameStyle,
  type ProgressiveImagePriority,
} from '@/lib/progressive-image';

interface ProgressiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading' | 'decoding' | 'fetchPriority'> {
  src: string;
  alt: string;
  aspectRatio?: string | null;
  priority?: ProgressiveImagePriority;
  viewportBound?: string;
  fit?: 'cover' | 'contain';
  imgClassName?: string;
  placeholderClassName?: string;
  children?: ReactNode;
}

export default function ProgressiveImage({
  src,
  alt,
  aspectRatio,
  priority = 'lazy',
  viewportBound,
  fit = 'cover',
  className,
  imgClassName,
  placeholderClassName,
  children,
  onLoad,
  style,
  ...imgProps
}: ProgressiveImageProps) {
  const decodeVersionRef = useRef(0);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const isLoaded = loadedSrc === src;
  const imageAttributes = resolveProgressiveImageAttributes(priority);
  const frameStyle: CSSProperties = {
    ...resolveProgressiveImageFrameStyle(aspectRatio, viewportBound),
    ...style,
  };

  const markReady = useCallback((image: HTMLImageElement | null, expectedSrc: string) => {
    if (!image) {
      return;
    }

    const decodeVersion = decodeVersionRef.current + 1;
    decodeVersionRef.current = decodeVersion;

    const finish = () => {
      if (decodeVersionRef.current === decodeVersion) {
        setLoadedSrc(expectedSrc);
      }
    };

    if (typeof image.decode === 'function') {
      void image.decode().then(finish, finish);
      return;
    }

    finish();
  }, []);

  const setImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      markReady(image, src);
    }
  }, [markReady, src]);

  return (
    <div
      className={cn('relative overflow-hidden bg-[#0D0D0D]', className)}
      style={frameStyle}
      data-loaded={isLoaded ? 'true' : 'false'}
    >
      <img
        {...imgProps}
        {...imageAttributes}
        ref={setImageRef}
        src={src}
        alt={alt}
        onLoad={(event) => {
          markReady(event.currentTarget, src);
          onLoad?.(event);
        }}
        className={cn(
          'block h-full w-full transition-[opacity,filter,transform] duration-500 ease-out',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-[1.01]',
          imgClassName
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          isLoaded ? 'opacity-0' : 'opacity-100',
          placeholderClassName
        )}
      >
        <div className="absolute inset-0 bg-[#111]" />
        <div className="progress-active-shimmer absolute inset-0 opacity-45" />
      </div>
      {children}
    </div>
  );
}
