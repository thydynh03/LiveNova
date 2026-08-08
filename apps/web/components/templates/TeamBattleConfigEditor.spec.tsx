import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TeamBattleConfigEditor } from './TeamBattleConfigEditor';
import type { TeamBattleConfig } from '@livenova/shared';

const SAMPLE_CONFIG: TeamBattleConfig = {
  teams: [
    {
      key: 'cat',
      name: 'Vương quốc Mèo',
      color: '#ef4444',
      castleAsset: 'castle_cat',
      giftNames: ['Rose', 'Hoa hồng'],
    },
    {
      key: 'dog',
      name: 'Vương quốc Chó',
      color: '#3b82f6',
      castleAsset: 'castle_dog',
      giftNames: ['Finger Heart'],
    },
  ],
  power: { like: 1, share: 3, follow: 10 },
  energy: { capacity: 30, refillPerSec: 0.5 },
  actions: [
    { minPower: 1, key: 'soldier', asset: 'fx_soldier' },
    { minPower: 10, key: 'castle', asset: 'fx_castle' },
    { minPower: 50, key: 'bomb', asset: 'fx_bomb' },
  ],
  freeEventMaxAction: 'castle',
  battle: { durationSec: 1200, showTopDonors: 4 },
};

describe('TeamBattleConfigEditor', () => {
  it('renders all initial teams and gifts', () => {
    const onChange = jest.fn();
    render(<TeamBattleConfigEditor value={SAMPLE_CONFIG} onChange={onChange} />);

    expect(screen.getByText('Các phe (2)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vương quốc Mèo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vương quốc Chó')).toBeInTheDocument();
    expect(screen.getByText('Rose')).toBeInTheDocument();
    expect(screen.getByText('Hoa hồng')).toBeInTheDocument();
    expect(screen.getByText('Finger Heart')).toBeInTheDocument();
  });

  it('allows adding a new team up to max limits', () => {
    const onChange = jest.fn();
    render(<TeamBattleConfigEditor value={SAMPLE_CONFIG} onChange={onChange} />);

    const addBtn = screen.getByRole('button', { name: /Thêm phe/i });
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedConfig = onChange.mock.calls[0][0] as TeamBattleConfig;
    expect(updatedConfig.teams.length).toBe(3);
    expect(updatedConfig.teams[2].key).toBe('team_3');
  });

  it('detects duplicate gifts across teams and displays warning indicator', () => {
    const conflictedConfig: TeamBattleConfig = {
      ...SAMPLE_CONFIG,
      teams: [
        { ...SAMPLE_CONFIG.teams[0], giftNames: ['Rose', 'Capybara'] },
        { ...SAMPLE_CONFIG.teams[1], giftNames: ['Rose', 'Finger Heart'] },
      ],
    };

    const onChange = jest.fn();
    render(<TeamBattleConfigEditor value={conflictedConfig} onChange={onChange} />);

    expect(screen.getAllByText(/Trùng lặp quà/i).length).toBeGreaterThan(0);
  });

  it('switches between tabs: teams, power, actions, battle, preview', () => {
    const onChange = jest.fn();
    render(<TeamBattleConfigEditor value={SAMPLE_CONFIG} onChange={onChange} />);

    // Switch to Power & Energy
    fireEvent.click(screen.getByRole('tab', { name: /Sức mạnh/i }));
    expect(screen.getByText(/Quy đổi hoả lực/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // energy capacity

    // Switch to Action Tiers
    fireEvent.click(screen.getByRole('tab', { name: /Bậc hoả lực/i }));
    expect(screen.getByText(/Bảng ngưỡng hành động/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('soldier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('castle')).toBeInTheDocument();

    // Switch to Battle Settings
    fireEvent.click(screen.getByRole('tab', { name: /Thiết lập trận/i }));
    expect(screen.getByText(/Thời lượng trận đấu/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('1200')).toBeInTheDocument();

    // Switch to Arena Preview
    fireEvent.click(screen.getByRole('tab', { name: /Xem sàn đấu/i }));
    expect(screen.getByText(/Mô phỏng sàn đấu \(2 phe\)/i)).toBeInTheDocument();
  });
});
