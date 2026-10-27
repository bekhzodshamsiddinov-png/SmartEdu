'use client';
import { useEffect } from 'react';

/** Ilovani telefonga o'rnatish va internetsiz ochilishi uchun service worker */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js', { scope: '/ilova' }).catch(() => {});
  }, []);
  return null;
}
