'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function IssuesRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (params.id) {
      router.replace(`/projects/${params.id}`);
    }
  }, [router, params]);

  return null;
}
