'use client';

// app/admin/page.jsx
// Landing do /admin — redireciona para /admin/usuarios.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/usuarios');
  }, [router]);
  return null;
}
