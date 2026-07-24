'use client';

import { ELEVATOR_FLOORS, useGameStore } from '@/store/game-store';

/**
 * Floor-selection panel shown once the producer has stepped into the elevator and before a floor is
 * chosen (`activeLocationId === 'elevator'` && `elevatorTo === null`). Picking a floor starts the ride;
 * the car animates and `tick` drops the rider on that floor. Deliberately a small bottom panel rather
 * than a full-screen modal, so the elevator interior stays visible while choosing.
 */
export function ElevatorFloors() {
  const inElevator = useGameStore((state) => state.activeLocationId === 'elevator');
  const choosing = useGameStore((state) => state.elevatorTo === null);
  const selectFloor = useGameStore((state) => state.selectFloor);
  if (!inElevator || !choosing) return null;
  return <section className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-6">
    <div className="pointer-events-auto rounded-2xl border border-paper/45 bg-[#161009]/92 px-5 py-4 text-center shadow-2xl backdrop-blur-sm">
      <p className="text-xs tracking-[0.18em] text-ember/90">SELECT A FLOOR</p>
      <div className="mt-3 flex gap-2">
        {ELEVATOR_FLOORS.map((floor) => (
          <button
            key={floor.key}
            onClick={() => selectFloor(floor.loc)}
            className="rounded-lg border border-paper/40 bg-paper/5 px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ember hover:text-night"
          >
            {floor.label}
          </button>
        ))}
      </div>
    </div>
  </section>;
}
