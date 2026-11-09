// Data every section of the panel needs, loaded once per panel: the unit chain and the unit's people with all roles.
// A section rendered on its own (as in its tests) loads them itself. [BCC-VIEW-1] [BCC-VIEW-8]
import React, { createContext, type ReactNode, useContext } from 'react';
import { type PeopleState, useUnitPeople } from '../../data/people';
import { useUnitChain } from '../../data/units';

type Chain = ReturnType<typeof useUnitChain>;
type PanelData = { unitKey: string; chain: Chain; people: PeopleState };

const PanelDataContext = createContext<PanelData | undefined>(undefined);

export const PanelDataProvider = ({
  unitKey,
  children,
}: {
  unitKey: string;
  children: ReactNode;
}) => {
  const chain = useUnitChain(unitKey);
  const people = useUnitPeople(unitKey);
  return (
    <PanelDataContext.Provider value={{ unitKey, chain, people }}>
      {children}
    </PanelDataContext.Provider>
  );
};

const useShared = (unitKey: string) => {
  const shared = useContext(PanelDataContext);
  return shared?.unitKey === unitKey ? shared : undefined;
};

export function usePanelChain(unitKey: string): Chain {
  const shared = useShared(unitKey);
  const own = useUnitChain(shared ? undefined : unitKey);
  return shared?.chain ?? own;
}

export function usePanelPeople(unitKey: string): PeopleState {
  const shared = useShared(unitKey);
  const own = useUnitPeople(shared ? undefined : unitKey);
  return shared?.people ?? own;
}
