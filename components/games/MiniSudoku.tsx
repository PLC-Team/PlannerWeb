'use client';
import React, { useState, useEffect } from 'react';

const PUZZLES = [
  [
    [1, 0, 3, 0, 5, 0],
    [0, 5, 0, 1, 0, 3],
    [2, 0, 4, 0, 6, 0],
    [0, 6, 0, 2, 0, 4],
    [3, 0, 5, 0, 1, 0],
    [0, 1, 0, 3, 0, 5]
  ],
  [
    [0, 1, 0, 3, 0, 5],
    [3, 0, 5, 0, 1, 0],
    [0, 6, 0, 2, 0, 4],
    [2, 0, 4, 0, 6, 0],
    [0, 5, 0, 1, 0, 3],
    [1, 0, 3, 0, 5, 0]
  ]
];

const MiniSudoku = React.memo(({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) => {
  const [board, setBoard] = useState<number[][]>([]);
  const [initialBoard, setInitialBoard] = useState<number[][]>([]);
  const [status, setStatus] = useState<'playing' | 'won'>('playing');
  const [startTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'playing') return;
    const interval = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  useEffect(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    const p = PUZZLES[dayOfYear % PUZZLES.length];
    setBoard(JSON.parse(JSON.stringify(p)));
    setInitialBoard(JSON.parse(JSON.stringify(p)));
  }, []);

  const handleChange = (r: number, c: number, val: string) => {
    if (status !== 'playing') return;
    const num = parseInt(val);
    const newBoard = [...board];
    newBoard[r][c] = isNaN(num) ? 0 : (num >= 1 && num <= 6 ? num : 0);
    setBoard(newBoard);
    checkWin(newBoard);
  };

  const checkWin = (currentBoard: number[][]) => {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (currentBoard[r][c] === 0) return;
      }
    }

    for (let i = 0; i < 6; i++) {
      const row = new Set();
      const col = new Set();
      for (let j = 0; j < 6; j++) {
        row.add(currentBoard[i][j]);
        col.add(currentBoard[j][i]);
      }
      if (row.size !== 6 || col.size !== 6) return;
    }

    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 2; bc++) {
        const box = new Set();
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 3; j++) {
            box.add(currentBoard[br * 2 + i][bc * 3 + j]);
          }
        }
        if (box.size !== 6) return;
      }
    }

    setStatus('won');
    onComplete(100, Math.floor((Date.now() - startTime) / 1000));
  };

  if (!board.length) return null;

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto p-6 backdrop-blur-md bg-slate-900/50 rounded-xl border border-white/10">
      <div className="flex flex-col w-full text-center">
        <h3 className="text-xl font-bold text-white font-heading tracking-widest mb-1">MINI SUDOKU</h3>
        <span className="text-xs text-cyan-400 font-mono">TIME: {Math.floor(timeElapsed / 60).toString().padStart(2, '0')}:{(timeElapsed % 60).toString().padStart(2, '0')}</span>
      </div>
      <p className="text-xs text-slate-400 text-center">Fill the grid with 1-6. No duplicates in any row, column, or 2x3 box.</p>
      
      <div className="grid grid-cols-6 gap-1 p-2 bg-slate-800 rounded-lg">
        {board.map((row, r) => (
          row.map((cell, c) => {
            const isInitial = initialBoard[r][c] !== 0;
            return (
              <input
                key={`${r}-${c}`}
                type="text"
                value={cell === 0 ? '' : cell}
                readOnly={isInitial}
                onChange={(e) => handleChange(r, c, e.target.value)}
                className={`w-12 h-12 text-center text-xl font-bold rounded transition-colors ${
                  isInitial 
                    ? 'bg-slate-700 text-slate-300' 
                    : 'bg-slate-900 text-cyan-400 border border-slate-600 focus:border-cyan-500 focus:outline-none'
                } ${r === 1 || r === 3 ? 'mb-2' : ''} ${c === 2 ? 'mr-2' : ''}`}
                maxLength={1}
              />
            );
          })
        ))}
      </div>

      {status === 'won' && (
        <div className="text-center animate-fade-in text-emerald-400 font-bold flex flex-col items-center">
          <span>Puzzle Solved!</span>
          <span className="text-sm mt-1 text-emerald-200 font-mono">Time: {Math.floor(timeElapsed / 60).toString().padStart(2, '0')}:{(timeElapsed % 60).toString().padStart(2, '0')}</span>
        </div>
      )}
    </div>
  );
});

export default MiniSudoku;
