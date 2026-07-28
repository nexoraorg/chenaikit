import React from 'react';

export interface OptimizedImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Prefer smaller asset on narrow screens when provided. */
  mobileSrc?: string;
}

/**
 * Responsive image with lazy loading and optional mobile source.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  mobileSrc,
  alt,
  className,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}) => {
  const classes = ['mobile-optimized', className].filter(Boolean).join(' ');

  if (mobileSrc) {
    return (
      <picture>
        <source media="(max-width: 599.95px)" srcSet={mobileSrc} />
        <img
          src={src}
          alt={alt}
          className={classes}
          loading={loading}
          decoding={decoding}
          {...rest}
        />
      </picture>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={classes}
      loading={loading}
      decoding={decoding}
      {...rest}
    />
  );
};

export default OptimizedImage;
