'use client';
import React, { useState, useEffect } from 'react';

const SIZE = 3;

const SlidingPuzzle = React.memo(({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) => {
  const [board, setBoard] = useState<number[]>([]);
  const [status, setStatus] = useState<'playing' | 'won'>('playing');
  const [startTime] = useState(Date.now());
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    // Generate solvable board
    let tiles = Array.from({ length: SIZE * SIZE }, (_, i) => i);
    // Shuffle
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    
    // Check solvability (inversions)
    let inversions = 0;
    for (let i = 0; i < tiles.length - 1; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i] !== 0 && tiles[j] !== 0 && tiles[i] > tiles[j]) {
          inversions++;
        }
      }
    }
    
    // For odd grid size, solvable if inversions is even
    if (inversions % 2 !== 0) {
      // Swap first two non-zero tiles to make it solvable
      let t1 = -1, t2 = -1;
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] !== 0) {
          if (t1 === -1) t1 = i;
          else if (t2 === -1) { t2 = i; break; }
        }
      }
      [tiles[t1], tiles[t2]] = [tiles[t2], tiles[t1]];
    }

    setBoard(tiles);
  }, []);

  const handleTileClick = (index: number) => {
    if (status !== 'playing') return;
    const emptyIndex = board.indexOf(0);
    
    // Check if adjacent
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const emptyRow = Math.floor(emptyIndex / SIZE);
    const emptyCol = emptyIndex % SIZE;

    const isAdjacent = Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;

    if (isAdjacent) {
      const newBoard = [...board];
      newBoard[emptyIndex] = newBoard[index];
      newBoard[index] = 0;
      setBoard(newBoard);
      setMoves(m => m + 1);

      // Check win
      let isWin = true;
      for (let i = 0; i < SIZE * SIZE - 1; i++) {
        if (newBoard[i] !== i + 1) {
          isWin = false;
          break;
        }
      }
      if (isWin && newBoard[SIZE * SIZE - 1] === 0) {
        setStatus('won');
        onComplete(100, Math.floor((Date.now() - startTime) / 1000));
      }
    }
  };

  if (board.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto p-6 backdrop-blur-md bg-slate-900/50 rounded-xl border border-white/10 select-none">
      <h3 className="text-xl font-bold text-white font-heading tracking-widest text-center">15 PUZZLE</h3>
      <p className="text-xs text-slate-400 text-center">Slide the tiles into numerical order (1-8).</p>
      
      <div className="text-cyan-400 font-mono text-xs font-bold w-full text-right px-2 -mb-2">MOVES: {moves}</div>

      <div className="bg-slate-800 p-2 rounded-xl grid grid-cols-3 gap-2">
        {board.map((tile, idx) => (
          <div 
            key={idx}
            onClick={() => handleTileClick(idx)}
            className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold transition-all duration-300 ${
              tile === 0 
                ? 'bg-slate-900 border border-slate-900 text-transparent' 
                : 'bg-slate-700 border-t border-l border-slate-600 border-b-2 border-r-2 border-slate-900 text-white cursor-pointer hover:bg-slate-600 active:translate-y-0.5 active:translate-x-0.5 active:border-b active:border-r'
            }`}
          >
            {tile !== 0 && tile}
          </div>
        ))}
      </div>

      {status === 'won' && (
        <p className="font-bold text-emerald-400 animate-fade-in text-lg mt-2">Puzzle Solved!</p>
      )}
    </div>
  );
});

export default SlidingPuzzle;
