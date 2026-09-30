import React, { useState, useEffect } from 'react';
import Canvas from '../components/Canvas';
import ChallengeOverlay from '../components/ChallengeOverlay';
import RoomLobby from '../components/RoomLobby';
import { socket } from '../services/socket';
import { SOCKET_EVENTS } from '../../../shared/events';

const SAMPLE_WORDS = ['Apple', 'Cat', 'House', 'Car', 'Tree', 'Sun', 'Pizza', 'Guitar', 'Bicycle', 'Helicopter'];

export default function SoloAIGame({ roomData, username }) {
  const [aiGuess, setAiGuess] = useState('Listening to your strokes...');
  const [aiConfidence, setAiConfidence] = useState(0);
  const [targetWord, setTargetWord] = useState('Apple');
  const [score, setScore] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(1);

  const nextWord = () => {
    const random = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
    setTargetWord(random);
    setRoundsPlayed((round) => round + 1);
    setAiGuess('AI is analyzing your strokes...');
    setAiConfidence(0);
    socket.emit(SOCKET_EVENTS.DRAW_CLEAR);
  };

  useEffect(() => {
    const handleAiPrediction = (data) => {
      if (!data) return;
      setAiGuess(data.guess);
      setAiConfidence(data.confidence);
      if (data.isCorrect) {
        setScore((currentScore) => currentScore + 500);
        nextWord();
      }
    };

    socket.on(SOCKET_EVENTS.SOLO_AI_PREDICTION_RESULT, handleAiPrediction);
    return () => socket.off(SOCKET_EVENTS.SOLO_AI_PREDICTION_RESULT, handleAiPrediction);
  }, []);

  if (roomData?.status === 'LOBBY') return <RoomLobby roomData={roomData} username={username} />;

  const confidence = Math.min(100, Math.max(0, aiConfidence));

  return (
    <section className="w-full flex flex-col gap-space-md" aria-label="Solo versus AI practice arena">
      <header className="bg-canvas-paper rounded-xl p-space-md border-4 border-border-dark shadow-[6px_6px_0px_#18181B] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-space-md items-center">
        <div className="min-w-0 flex items-center gap-space-sm">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-secondary-fixed border-2 border-border-dark shadow-[2px_2px_0px_#18181B] flex items-center justify-center">
            <span className="material-symbols-outlined text-[25px] text-on-secondary-fixed">smart_toy</span>
          </div>
          <div className="min-w-0">
            <p className="font-label-sm text-label-sm text-primary uppercase font-bold">Practice mode · live evaluator</p>
            <h1 className="font-headline-md text-headline-md text-border-dark uppercase font-black">Play with AI</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Make a clear sketch and watch the guesser react in real time.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-space-xs w-full md:w-auto">
          <div className="bg-tertiary-fixed border-2 border-border-dark rounded-xl px-space-sm py-space-xs text-center min-w-0">
            <span className="font-label-sm text-label-sm text-on-tertiary-fixed block uppercase">Draw</span>
            <span className="font-headline-sm text-headline-sm text-border-dark uppercase truncate block">{targetWord}</span>
          </div>
          <div className="bg-surface-card border-2 border-border-dark rounded-xl px-space-sm py-space-xs text-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">Round</span>
            <span className="font-headline-sm text-headline-sm text-secondary font-black">{roundsPlayed}</span>
          </div>
          <div className="bg-primary-container text-on-primary border-2 border-border-dark rounded-xl px-space-sm py-space-xs text-center shadow-[2px_2px_0px_#18181B]">
            <span className="font-label-sm text-label-sm text-on-primary block uppercase">Score</span>
            <span className="font-headline-sm text-headline-sm text-on-primary font-black">{score}</span>
          </div>
        </div>
      </header>

      <ChallengeOverlay challenge={roomData?.currentChallenge} forcedColor={roomData?.forcedColor} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <main className="lg:col-span-8 min-w-0 bg-canvas-paper rounded-xl p-space-sm md:p-space-md border-3 border-border-dark shadow-[4px_4px_0px_#18181B]">
          <div className="flex flex-wrap items-center justify-between gap-space-xs pb-space-sm mb-space-sm border-b-2 border-border-dark">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">brush</span>
              <h2 className="font-headline-sm text-headline-sm text-border-dark uppercase font-black">Drawing desk</h2>
            </div>
            <span className="font-label-sm text-label-sm bg-surface-container px-space-sm py-1 rounded-full border border-border-dark text-on-surface-variant uppercase">Target: {targetWord}</span>
          </div>
          <div className="flex justify-center min-w-0">
            <Canvas isDrawer={true} challenge={roomData?.currentChallenge} forcedColor={roomData?.forcedColor} />
          </div>
        </main>

        <aside className="lg:col-span-4 flex flex-col gap-space-md">
          <div className="bg-canvas-paper rounded-xl p-space-md border-3 border-border-dark shadow-[4px_4px_0px_#18181B] flex flex-col gap-space-md">
            <div className="flex items-center justify-between gap-space-sm pb-space-xs border-b-2 border-border-dark">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-secondary-fixed border-2 border-border-dark flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-on-secondary-fixed">psychology</span>
                </span>
                <h2 className="font-headline-sm text-headline-sm text-border-dark uppercase font-black">AI guesser</h2>
              </div>
              <span className="font-label-sm text-label-sm bg-primary-fixed text-on-primary-fixed border border-border-dark px-2 py-0.5 rounded-full font-bold">LIVE</span>
            </div>
            <div className="bg-surface-card-subtle p-space-md rounded-xl border-2 border-border-dark text-center">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Current guess</span>
              <p className="font-headline-md text-headline-md text-secondary font-black break-words mt-space-xs">{aiGuess}</p>
            </div>
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-label-md text-label-md text-on-surface font-bold">
                <span>CONFIDENCE</span><span className="text-primary">{confidence}%</span>
              </div>
              <div className="w-full h-4 bg-slot-empty rounded-full border border-border-dark overflow-hidden p-0.5" aria-label={`AI confidence ${confidence}%`}>
                <div className="h-full bg-primary-container rounded-full transition-all duration-300" style={{ width: `${Math.max(4, confidence)}%` }} />
              </div>
            </div>
            <button className="w-full mt-space-xs py-space-sm rounded-xl bg-tertiary-fixed text-on-tertiary-fixed font-headline-sm text-headline-sm uppercase border-3 border-border-dark shadow-[3px_3px_0px_#18181B] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2" onClick={nextWord} type="button">
              <span className="material-symbols-outlined text-[20px]">skip_next</span>Skip word
            </button>
          </div>
          <div className="bg-surface-container-low rounded-xl p-space-md border-2 border-border-dark flex gap-space-sm">
            <span className="material-symbols-outlined text-accent-blue text-[20px] shrink-0">tips_and_updates</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Use simple, distinctive shapes. Practice scores stay out of the global leaderboard.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
