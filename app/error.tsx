'use client';
import React from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-white bg-red-900/50 rounded-xl max-w-2xl mx-auto mt-20">
      <h2 className="text-2xl font-bold mb-4">A ROOT ERROR occurred!</h2>
      <p className="font-mono text-sm bg-black/50 p-4 rounded mb-4">
        {error.message || 'Unknown error'}
      </p>
      <pre className="font-mono text-xs text-red-200 whitespace-pre-wrap max-h-[400px] overflow-auto">
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-red-500 rounded hover:bg-red-400"
      >
        Try again
      </button>
    </div>
  );
}
