'use client';
import React, { useState, useEffect } from 'react';

const EMOJIS = ['🤖', '⚙️', '🚀', '💡', '🔋', '🔌', '💻', '📡'];

export default function MemoryMatch({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) {
  const [cards, setCards] = useState<{ id: number; emoji: string; isFlipped: boolean; isMatched: boolean }[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(Date.now());
  const [status, setStatus] = useState<'playing' | 'won'>('playing');

  useEffect(() => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({ id: idx, emoji, isFlipped: false, isMatched: false }));
    setCards(shuffled);
  }, []);

  useEffect(() => {
    if (flippedIds.length === 2) {
      const [firstId, secondId] = flippedIds;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard && secondCard && firstCard.emoji === secondCard.emoji) {
        setCards(prev => prev.map(c => c.emoji === firstCard.emoji ? { ...c, isMatched: true } : c));
        setMatches(m => m + 1);
        setFlippedIds([]);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === firstId || c.id === secondId) ? { ...c, isFlipped: false } : c));
          setFlippedIds([]);
        }, 1000);
      }
      setMoves(m => m + 1);
    }
  }, [flippedIds, cards]);

  useEffect(() => {
    if (matches === EMOJIS.length && matches > 0 && status === 'playing') {
      setStatus('won');
      const score = Math.max(100 - moves * 2, 10);
      onComplete(score, Math.floor((Date.now() - startTime) / 1000));
    }
  }, [matches, moves, status, startTime, onComplete]);

  const handleFlip = (id: number) => {
    if (flippedIds.length === 2 || cards.find(c => c.id === id)?.isFlipped || status !== 'playing') return;
    setCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));
    setFlippedIds(prev => [...prev, id]);
  };

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto p-6 backdrop-blur-md bg-slate-900/50 rounded-xl border border-white/10">
      <h3 className="text-xl font-bold text-white font-heading tracking-widest">MEMORY MATCH</h3>
      <div className="flex justify-between w-full text-xs text-cyan-400 font-mono px-2">
        <span>MOVES: {moves}</span>
        <span>MATCHES: {matches}/{EMOJIS.length}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full">
        {cards.map(card => (
          <div 
            key={card.id} 
            onClick={() => handleFlip(card.id)}
            className={`aspect-square flex items-center justify-center text-3xl rounded-xl cursor-pointer transition-all duration-300 transform preserve-3d ${
              card.isFlipped || card.isMatched ? 'rotate-y-180 bg-blue-500/20 border border-blue-400/50' : 'bg-slate-800 border border-white/5 hover:border-cyan-500/50 hover:bg-slate-700'
            }`}
          >
            <span className={card.isFlipped || card.isMatched ? 'opacity-100' : 'opacity-0'}>
              {card.emoji}
            </span>
          </div>
        ))}
      </div>

      {status === 'won' && (
        <div className="mt-2 text-center animate-fade-in text-emerald-400 font-bold">
          Awesome Memory!
        </div>
      )}
    </div>
  );
}
