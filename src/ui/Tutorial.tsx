import { useEffect, useState, type ReactNode } from 'react';
import { setTutorialOff, tutorialOff } from '../persist/prefs';
import { useBoard } from '../store/boardStore';

const BLUE = '#2563eb';
const RED = '#dc2626';

// ---- little pictures (200 x 110, one per step) ----
function Scene({ children }: { children: ReactNode }) {
  return (
    <svg className="tut-scene" viewBox="0 0 200 110" role="img" aria-hidden>
      <rect width="200" height="110" rx="10" fill="#1f8542" />
      <rect x="100" width="50" height="110" fill="#1c7c3c" />
      <rect x="0" width="50" height="110" fill="#1c7c3c" />
      {children}
    </svg>
  );
}
function Dot({ x, y, color, label, you }: { x: number; y: number; color: string; label?: string; you?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {you && <circle r="15" fill="rgba(250,204,21,0.3)" stroke="#facc15" strokeWidth="2" />}
      <circle r="10" fill={color} stroke="#fff" strokeWidth="1.5" />
      {label && (
        <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
          {label}
        </text>
      )}
    </g>
  );
}
const BallDot = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="5" fill="#fff" stroke="#0f172a" strokeWidth="1.2" />
    <circle r="1.6" fill="#0f172a" />
  </g>
);
/** A fingertip. `taps` makes it pulse twice. */
const Finger = ({ x, y, taps }: { x: number; y: number; taps?: boolean }) => (
  <circle className={taps ? 'tut-tap' : undefined} cx={x} cy={y} r="9" fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth="1.5" />
);
const Ghost = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="10" fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth="1.2" strokeDasharray="3 3" />;

const scenes: ReactNode[] = [
  <Scene key="welcome">
    <Ghost x={150} y={30} />
    <path d="M118 62 L142 37" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
    <Dot x={110} y={70} color={BLUE} label="3" you />
    <Dot x={60} y={50} color={BLUE} label="5" />
    <BallDot x={72} y={50} />
    <Dot x={92} y={40} color={RED} label="4" />
    <Dot x={160} y={78} color={RED} label="2" />
  </Scene>,
  <Scene key="dribble">
    <Dot x={150} y={28} color={RED} label="2" />
    <Dot x={40} y={84} color={BLUE} label="3" />
    <g className="tut-slide">
      <Dot x={60} y={55} color={BLUE} label="5" />
      <BallDot x={72} y={55} />
      <Finger x={62} y={60} />
    </g>
  </Scene>,
  <Scene key="pass">
    <rect x="186" y="35" width="14" height="40" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.5" />
    <Dot x={45} y={70} color={BLUE} label="5" />
    <Dot x={125} y={35} color={BLUE} label="4" />
    <path d="M57 66 L113 40" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
    <g className="tut-pass">
      <BallDot x={57} y={66} />
    </g>
    <Finger x={128} y={39} taps />
  </Scene>,
  <Scene key="aim">
    <rect x="186" y="30" width="14" height="50" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.5" />
    <Dot x={172} y={55} color={RED} label="1" />
    <Dot x={70} y={62} color={BLUE} label="5" />
    <BallDot x={82} y={62} />
    <path d="M82 62 L186 36" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
    <Finger x={70} y={66} taps />
    <g className="tut-aim">
      <Finger x={70} y={66} />
    </g>
  </Scene>,
  <Scene key="pin">
    <Dot x={50} y={40} color={BLUE} label="5" />
    <BallDot x={62} y={40} />
    <g className="tut-slide">
      <Dot x={80} y={80} color={BLUE} label="2" />
      <g transform="translate(88 72)">
        <circle r="5" fill="#0f172a" stroke="#fff" strokeWidth="1" />
        <circle cy="-1" r="1.8" fill="#f87171" />
        <line y1="1" y2="3.5" stroke="#f87171" strokeWidth="1.2" />
      </g>
      <Finger x={82} y={85} />
    </g>
  </Scene>,
  <Scene key="why">
    <Dot x={60} y={34} color={BLUE} label="5" />
    <BallDot x={72} y={34} />
    <Dot x={130} y={42} color={BLUE} label="3" you />
    <rect x="14" y="70" width="172" height="30" rx="7" fill="#174a2c" stroke="#facc15" strokeWidth="1.5" />
    <text x="24" y="83" fontSize="7" fontWeight="700" fill="#facc15">
      YOU
    </text>
    <text x="24" y="94" fontSize="9" fontWeight="600" fill="#f1f5f9">
      Get open for a pass!
    </text>
  </Scene>,
];

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Move the ball. Watch the team.',
    text: 'Every player goes where they should be, and the board tells you why. The basics take 20 seconds.',
  },
  {
    title: 'Dribble',
    text: 'Drag the player who has the ball. Everyone else finds their spot as you go.',
  },
  {
    title: 'Pass',
    text: 'Double-tap a teammate to pass to them. Double-tap the grass to kick the ball to that spot.',
  },
  {
    title: 'Aim a shot',
    text: 'Double-tap the player with the ball and keep your finger down on the second tap. Drag to aim, let go to shoot. Try a corner of the goal!',
  },
  {
    title: 'Put a player somewhere',
    text: 'Drag anyone else and they stay pinned where you leave them. The pin button at the top lets them all go again.',
  },
  {
    title: 'See the reason',
    text: 'The yellow player is You: the bottom panel says why You move. Tap anyone to see theirs, or hold a player for more. The gear has levels and pitch sizes.',
  },
];

/** A short first-run tour. Skippable, and "Don't show this again" is remembered on the device. */
export function Tutorial() {
  const open = useBoard((s) => s.ui.tutorialOpen);
  const [step, setStep] = useState(0);
  const [never, setNever] = useState(tutorialOff);
  useEffect(() => {
    if (open) {
      setStep(0);
      setNever(tutorialOff());
    }
  }, [open]);
  if (!open) return null;

  const close = (): void => {
    setTutorialOff(never);
    useBoard.getState().setUi({ tutorialOpen: false });
  };
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <>
      <div className="backdrop" />
      <section className="tutorial" data-testid="tutorial" role="dialog" aria-modal aria-label="How to use the board">
        {scenes[step]}
        <div className="tut-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <h2 data-testid="tutorial-title">{s.title}</h2>
        <p>{s.text}</p>
        <div className="tut-actions">
          {step > 0 ? (
            <button data-testid="tutorial-back" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <button data-testid="tutorial-skip" onClick={close}>
              Skip
            </button>
          )}
          <button className="primary" data-testid="tutorial-next" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Start playing' : 'Next'}
          </button>
        </div>
        <div className="tut-foot">
          <label className="check">
            <input type="checkbox" data-testid="tutorial-never" checked={never} onChange={(e) => setNever(e.target.checked)} />
            <span>Don't show this again</span>
          </label>
          {step > 0 && !last && (
            <button className="link" data-testid="tutorial-skip" onClick={close}>
              Skip
            </button>
          )}
        </div>
      </section>
    </>
  );
}
