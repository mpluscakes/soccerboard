// Small per-device preferences. localStorage rather than a cookie: it does the
// same job, is never sent over the network, and survives in the installed app.
const TUTORIAL_KEY = 'soccerboard.tutorial';

/** True once the user has ticked "Don't show this again". */
export function tutorialOff(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'off';
  } catch {
    return false; // storage blocked: show it
  }
}

export function setTutorialOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(TUTORIAL_KEY, 'off');
    else localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}
