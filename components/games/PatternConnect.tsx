'use client';
import React, { useState, useEffect } from 'react';

type Point = { r: number; c: number };
type ColorPath = { color: string; path: Point[]; completed: boolean };

const BOARD_SIZE = 5;
const LEVEL = [
  { color: 'bg-red-500', start: { r: 0, c: 0 }, end: { r: 4, c: 4 } },
  { color: 'bg-blue-500', start: { r: 0, c: 4 }, end: { r: 4, c: 0 } },
  { color: 'bg-yellow-500', start: { r: 0, c: 2 }, end: { r: 2, c: 2 } }
];

export default function PatternConnect({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) {
  const [paths, setPaths] = useState<ColorPath[]>(
    LEVEL.map(l => ({ color: l.color, path: [l.start], completed: false }))
  );
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [status, setStatus] = useState<'playing' | 'won'>('playing');
  const [startTime] = useState(Date.now());

  useEffect(() => {
    // Check win condition (all board filled and all endpoints reached)
    const allEndpointsReached = paths.every(p => {
      const levelDef = LEVEL.find(l => l.color === p.color);
      if (!levelDef) return false;
      const last = p.path[p.path.length - 1];
      return last.r === levelDef.end.r && last.c === levelDef.end.c;
    });

    const totalCells = paths.reduce((acc, p) => acc + p.path.length, 0);
    if (allEndpointsReached && totalCells === BOARD_SIZE * BOARD_SIZE && status === 'playing') {
      setStatus('won');
      onComplete(100, Math.floor((Date.now() - startTime) / 1000));
    }
  }, [paths, status, startTime, onComplete]);

  const handlePointerDown = (r: number, c: number) => {
    if (status !== 'playing') return;
    // Check if clicked on a start or end point
    const endpoint = LEVEL.find(l => (l.start.r === r && l.start.c === c) || (l.end.r === r && l.end.c === c));
    if (endpoint) {
      setActiveColor(endpoint.color);
      // Reset path for this color
      setPaths(prev => prev.map(p => p.color === endpoint.color ? { color: endpoint.color, path: [{ r, c }], completed: false } : p));
    }
  };

  const handlePointerEnter = (r: number, c: number) => {
    if (!activeColor || status !== 'playing') return;

    setPaths(prev => {
      const newPaths = [...prev];
      const activePathIndex = newPaths.findIndex(p => p.color === activeColor);
      const activePath = newPaths[activePathIndex];

      // Check if trying to overwrite an endpoint of another color
      const isOtherEndpoint = LEVEL.find(l => l.color !== activeColor && ((l.start.r === r && l.start.c === c) || (l.end.r === r && l.end.c === c)));
      if (isOtherEndpoint) return prev;

      // Check if adjacent
      const lastPoint = activePath.path[activePath.path.length - 1];
      const isAdjacent = Math.abs(lastPoint.r - r) + Math.abs(lastPoint.c - c) === 1;

      if (isAdjacent) {
        // Truncate path if backtracking
        const backtrackIndex = activePath.path.findIndex(pt => pt.r === r && pt.c === c);
        if (backtrackIndex !== -1) {
          activePath.path = activePath.path.slice(0, backtrackIndex + 1);
        } else {
          // Remove cell from other paths if overwritten
          newPaths.forEach((p, idx) => {
            if (idx !== activePathIndex) {
              p.path = p.path.filter(pt => pt.r !== r || pt.c !== c);
            }
          });
          activePath.path.push({ r, c });

          // Check if reached endpoint
          const levelDef = LEVEL.find(l => l.color === activeColor);
          if (levelDef) {
            const isEndpoint = (levelDef.start.r === r && levelDef.start.c === c) || (levelDef.end.r === r && levelDef.end.c === c);
            if (isEndpoint) {
              activePath.completed = true;
              setActiveColor(null); // auto stop dragging
            }
          }
        }
      }
      return newPaths;
    });
  };

  const handlePointerUp = () => {
    setActiveColor(null);
  };

  const getCellClasses = (r: number, c: number) => {
    // Is Endpoint?
    const endpoint = LEVEL.find(l => (l.start.r === r && l.start.c === c) || (l.end.r === r && l.end.c === c));
    
    // Is in path?
    const path = paths.find(p => p.path.some(pt => pt.r === r && pt.c === c));

    let classes = "w-12 h-12 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer ";
    
    if (endpoint) {
      classes += "bg-slate-800 ";
    } else if (path) {
      classes += `${path.color} opacity-80 `;
    } else {
      classes += "bg-slate-900 hover:bg-slate-800 ";
    }

    return (
      <div 
        key={`${r}-${c}`}
        onPointerDown={() => handlePointerDown(r, c)}
        onPointerEnter={() => handlePointerEnter(r, c)}
        className={classes}
        style={{ touchAction: 'none' }}
      >
        {endpoint && (
          <div className={`w-6 h-6 rounded-full shadow-lg ${endpoint.color} ${path?.completed ? 'scale-110 shadow-[0_0_15px_currentColor]' : ''}`} />
        )}
        {!endpoint && path && (
          <div className="w-4 h-4 rounded-full bg-white/20" />
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col items-center gap-6 max-w-sm mx-auto p-6 backdrop-blur-md bg-slate-900/50 rounded-xl border border-white/10 select-none"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <h3 className="text-xl font-bold text-white font-heading tracking-widest text-center">PATTERN CONNECT</h3>
      <p className="text-xs text-slate-400 text-center">Connect matching colors to fill the entire board.</p>
      
      <div className="bg-slate-950 p-2 rounded-xl grid grid-cols-5 gap-0 touch-none">
        {Array.from({ length: BOARD_SIZE }).map((_, r) => 
          Array.from({ length: BOARD_SIZE }).map((_, c) => getCellClasses(r, c))
        )}
      </div>

      {status === 'won' && (
        <p className="font-bold text-emerald-400 animate-fade-in text-lg mt-2">Patterns Connected!</p>
      )}
    </div>
  );
}
