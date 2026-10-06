import React, { useState, useEffect } from 'react';
import { getPhoto } from '../utils/photoStorage';

interface Props {
  photoKey?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function PhotoFromIndexedDB({
  photoKey,
  alt = '',
  className = '',
  fallback = null,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!photoKey) {
        setSrc(null);
        return;
      }

      // If it's already a Base64 (legacy), use directly
      if (photoKey.startsWith('data:image/') || photoKey.startsWith('blob:') || photoKey.startsWith('http')) {
        setSrc(photoKey);
        return;
      }

      // It's an IndexedDB key
      setLoading(true);
      try {
        const photo = await getPhoto(photoKey);
        if (!cancelled) setSrc(photo);
      } catch (err) {
        console.warn('Failed to load photo from IndexedDB:', photoKey, err);
        if (!cancelled) setSrc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [photoKey]);

  if (loading) {
    return <div className={className + ' bg-slate-800 animate-pulse'} />;
  }

  if (!src) {
    return <>{fallback}</>;
  }

  return <img src={src} alt={alt} className={className} />;
}
