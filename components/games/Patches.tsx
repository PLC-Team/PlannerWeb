'use client';
import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, RefreshCcw, Info } from 'lucide-react';

interface Point {
  r: number;
  c: number;
}

interface Shape {
  id: string;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  color: string;
}

interface PuzzleNumber {
  r: number;
  c: number;
  v: number;
}

const COLORS = [
  'bg-red-500', 'bg-teal-500', 'bg-amber-500', 'bg-purple-500',
  'bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-indigo-500'
];

const Patches = React.memo(({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) => {
  const [gridSize] = useState(5);
  const [numbers] = useState<PuzzleNumber[]>([
    { r: 0, c: 0, v: 5 },
    { r: 1, c: 0, v: 8 },
    { r: 3, c: 4, v: 9 },
    { r: 4, c: 4, v: 3 }
  ]);
  
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentDrag, setCurrentDrag] = useState<{ start: Point; end: Point } | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [isWon, setIsWon] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const boardRef = useRef<HTMLDivElement>(null);

  const getCellFromEvent = (e: React.PointerEvent | PointerEvent) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
    
    const cellWidth = rect.width / gridSize;
    const cellHeight = rect.height / gridSize;
    
    const c = Math.floor(x / cellWidth);
    const r = Math.floor(y / cellHeight);
    
    return { r, c };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isWon) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;

    // Check if clicked on an existing shape to remove it
    const existingShapeIndex = shapes.findIndex(
      s => cell.r >= s.r1 && cell.r <= s.r2 && cell.c >= s.c1 && cell.c <= s.c2
    );
    
    if (existingShapeIndex !== -1) {
      setShapes(prev => prev.filter((_, i) => i !== existingShapeIndex));
      return;
    }

    // Start drawing a new shape
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCurrentDrag({ start: cell, end: cell });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!currentDrag || isWon) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    setCurrentDrag({ start: currentDrag.start, end: cell });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!currentDrag || isWon) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const { start, end } = currentDrag;
    const r1 = Math.min(start.r, end.r);
    const r2 = Math.max(start.r, end.r);
    const c1 = Math.min(start.c, end.c);
    const c2 = Math.max(start.c, end.c);
    
    setCurrentDrag(null);

    // Check for overlap with existing shapes
    let overlap = false;
    for (const s of shapes) {
      if (r1 <= s.r2 && r2 >= s.r1 && c1 <= s.c2 && c2 >= s.c1) {
        overlap = true;
        break;
      }
    }

    if (!overlap) {
      setShapes(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        r1, c1, r2, c2,
        color: COLORS[prev.length % COLORS.length]
      }]);
    }
  };

  // Check win condition
  useEffect(() => {
    if (isWon) return;

    // 1. All cells must be covered
    let totalArea = 0;
    for (const s of shapes) {
      totalArea += (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
    }
    if (totalArea !== gridSize * gridSize) return;

    // 2. Each shape must contain exactly one number, and match its value
    let allValid = true;
    for (const s of shapes) {
      const area = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
      const containedNumbers = numbers.filter(
        n => n.r >= s.r1 && n.r <= s.r2 && n.c >= s.c1 && n.c <= s.c2
      );

      if (containedNumbers.length !== 1 || containedNumbers[0].v !== area) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      setIsWon(true);
      const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeout(() => {
        onComplete(100, timeElapsed);
      }, 1500);
    }
  }, [shapes, numbers, gridSize, isWon, startTime, onComplete]);

  // Helper to render current drag outline
  const getDragStyle = () => {
    if (!currentDrag) return { display: 'none' };
    const r1 = Math.min(currentDrag.start.r, currentDrag.end.r);
    const r2 = Math.max(currentDrag.start.r, currentDrag.end.r);
    const c1 = Math.min(currentDrag.start.c, currentDrag.end.c);
    const c2 = Math.max(currentDrag.start.c, currentDrag.end.c);

    return {
      top: `${(r1 / gridSize) * 100}%`,
      left: `${(c1 / gridSize) * 100}%`,
      width: `${((c2 - c1 + 1) / gridSize) * 100}%`,
      height: `${((r2 - r1 + 1) / gridSize) * 100}%`,
    };
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[500px]">
      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-8 shadow-xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white tracking-widest font-heading">PATCHES</h2>
          <button onClick={() => setShapes([])} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg text-sm text-slate-300 flex gap-3 border border-slate-700/50">
          <Info className="w-5 h-5 text-purple-400 shrink-0" />
          <p>
            Drag to draw rectangles or squares. Fill the grid so that each shape contains exactly one number, and the area of the shape equals that number. Click a shape to remove it.
          </p>
        </div>

        {/* Game Board */}
        <div className="relative w-full aspect-square max-w-[400px] mx-auto bg-white rounded-lg overflow-hidden border-2 border-slate-300 select-none touch-none"
             ref={boardRef}
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}>
          
          {/* Grid Lines */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gridTemplateRows: `repeat(${gridSize}, 1fr)` }}>
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-slate-200 border-dashed pointer-events-none" />
            ))}
          </div>

          {/* Numbers */}
          {numbers.map((n, i) => {
            // Check if this number is covered by a shape
            const coveringShape = shapes.find(s => n.r >= s.r1 && n.r <= s.r2 && n.c >= s.c1 && n.c <= s.c2);
            const isCovered = !!coveringShape;

            return (
              <div 
                key={i}
                className={`absolute flex items-center justify-center font-bold text-xl pointer-events-none transition-colors ${isCovered ? 'text-white' : 'text-slate-800'}`}
                style={{
                  top: `${(n.r / gridSize) * 100}%`,
                  left: `${(n.c / gridSize) * 100}%`,
                  width: `${100 / gridSize}%`,
                  height: `${100 / gridSize}%`,
                  zIndex: 10
                }}
              >
                {n.v}
              </div>
            );
          })}

          {/* Placed Shapes */}
          {shapes.map((s) => (
            <div
              key={s.id}
              className={`absolute ${s.color} opacity-90 border-2 border-white/50 rounded-md shadow-sm pointer-events-none transition-all duration-200`}
              style={{
                top: `${(s.r1 / gridSize) * 100}%`,
                left: `${(s.c1 / gridSize) * 100}%`,
                width: `${((s.c2 - s.c1 + 1) / gridSize) * 100}%`,
                height: `${((s.r2 - s.r1 + 1) / gridSize) * 100}%`,
              }}
            />
          ))}

          {/* Current Drag Preview */}
          <div
            className="absolute bg-purple-500/30 border-2 border-purple-500/80 rounded-md pointer-events-none"
            style={getDragStyle()}
          />
        </div>

        {isWon && (
          <div className="mt-6 text-center animated-fade">
            <p className="text-xl font-bold text-emerald-400">Puzzle Solved! Awesome!</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default Patches;
