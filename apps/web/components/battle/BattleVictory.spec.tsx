import { render, act, screen } from '@testing-library/react';
import React from 'react';
import type { BattleState } from '@livenova/shared';
import { BattleVictory } from './BattleVictory';

const team = (key: string, name: string, color: string, score: number) => ({
  key,
  name,
  color,
  score,
  energy: 100,
  castleHp: 1000,
  maxHp: 1000,
  giftNames: [],
});

const state = (over: Partial<BattleState> = {}): BattleState => ({
  kind: 'battle',
  battleId: 'b1',
  title: 'TRẬN THỬ',
  teams: [
    team('cat', 'VƯƠNG QUỐC MÈO', '#c084fc', 3400),
    team('dog', 'VƯƠNG QUỐC CHÓ', '#60a5fa', 2200),
  ],
  topDonors: [
    { username: '@a', nickname: 'Mèo1', teamKey: 'cat', totalScore: 900 },
    { username: '@b', nickname: 'Chó1', teamKey: 'dog', totalScore: 5000 },
    { username: '@c', nickname: 'Mèo2', teamKey: 'cat', totalScore: 2500 },
  ],
  recentEvents: [],
  winnerTeamKey: 'cat',
  endsAtMs: 0,
  active: false,
  ...over,
});

/** Long enough to land past both stage timers. */
const runSequence = () => act(() => void jest.advanceTimersByTime(4000));

describe('BattleVictory', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('names the winning kingdom and its score', () => {
    render(<BattleVictory battle={state()} />);
    runSequence();

    expect(screen.getByText('VƯƠNG QUỐC MÈO')).toBeInTheDocument();
    expect(screen.getByText(/VÔ ĐỊCH/)).toHaveTextContent('3.400');
  });

  it('holds the winner back until the screen has settled', () => {
    render(<BattleVictory battle={state()} />);

    // The first beat is the dim alone: announcing the winner in the same frame
    // the fight stops gives the audience nothing to land on.
    expect(screen.queryByText('VƯƠNG QUỐC MÈO')).not.toBeInTheDocument();
    act(() => void jest.advanceTimersByTime(1000));
    expect(screen.getByText('VƯƠNG QUỐC MÈO')).toBeInTheDocument();
  });

  it('rolls the winning kingdom’s own donors, biggest first', () => {
    render(<BattleVictory battle={state()} />);
    runSequence();

    expect(screen.getByText('Mèo2')).toBeInTheDocument();
    expect(screen.getByText('Mèo1')).toBeInTheDocument();
    // The biggest donor on the board backed the losing side; celebrating them
    // under the winner's crown would credit the wrong kingdom.
    expect(screen.queryByText('Chó1')).not.toBeInTheDocument();

    const names = screen.getAllByText(/^Mèo[12]$/).map((n) => n.textContent);
    expect(names).toEqual(['Mèo2', 'Mèo1']);
  });

  it('calls a draw rather than crowning anyone', () => {
    render(<BattleVictory battle={state({ winnerTeamKey: null })} />);
    runSequence();

    expect(screen.getByText('BẤT PHÂN THẮNG BẠI')).toBeInTheDocument();
    expect(screen.queryByText('VƯƠNG QUỐC MÈO')).not.toBeInTheDocument();
    expect(screen.queryByText(/VÔ ĐỊCH/)).not.toBeInTheDocument();
  });

  it('lays out the same confetti on the server and the client', () => {
    // Seeded, not random: a mismatch at hydration throws the markup away and
    // the celebration flickers on its first frame.
    const first = render(<BattleVictory battle={state()} />);
    runSequence();
    const a = first.container.innerHTML;
    first.unmount();

    const second = render(<BattleVictory battle={state()} />);
    runSequence();
    expect(second.container.innerHTML).toBe(a);
  });
});
