import { Board } from '../../board/Board';
import { PlayerMenu } from '../../ui/PlayerMenu';
import { ReasonPanel } from '../../ui/ReasonPanel';
import { SetupSheet } from '../../ui/SetupSheet';
import { Toolbar } from '../../ui/Toolbar';

/** v1 mode: move the ball or the carrier, pass or kick, and everyone else reacts. */
export function Sandbox() {
  return (
    <div className="app" data-testid="sandbox">
      <Toolbar />
      <Board />
      <ReasonPanel />
      <PlayerMenu />
      <SetupSheet />
    </div>
  );
}
