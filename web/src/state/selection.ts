import { create } from 'zustand';
import { ContainerStats, Group } from '../types';

export type Selection =
  | { kind: 'none' }
  | { kind: 'planet'; id: string; container: ContainerStats; persistent: boolean }
  | { kind: 'group'; key: string; group: Group };

export interface Hover {
  planetId: string | null;
  container: ContainerStats | null;
}

interface SelectionState {
  selection: Selection;
  hover: Hover;
  setSelection: (selection: Selection) => void;
  selectPlanet: (id: string, container: ContainerStats, persistent?: boolean) => void;
  selectGroup: (key: string, group: Group) => void;
  clearSelection: () => void;
  setHover: (planetId: string | null, container: ContainerStats | null) => void;
  clearHover: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: { kind: 'none' },
  hover: { planetId: null, container: null },
  
  setSelection: (selection) => set({ selection }),
  
  selectPlanet: (id, container, persistent = false) => 
    set({ selection: { kind: 'planet', id, container, persistent } }),
  
  selectGroup: (key, group) => 
    set({ selection: { kind: 'group', key, group } }),
  
  clearSelection: () => 
    set({ selection: { kind: 'none' } }),
  
  setHover: (planetId, container) =>
    set({ hover: { planetId, container } }),
  
  clearHover: () =>
    set({ hover: { planetId: null, container: null } }),
}));

// Derived selectors
export const getSelectedPlanet = (state: SelectionState) => 
  state.selection.kind === 'planet' ? state.selection.container : null;

export const getSelectedGroup = (state: SelectionState) => 
  state.selection.kind === 'group' ? state.selection.group : null;

export const isGroupSelected = (state: SelectionState) => 
  state.selection.kind === 'group';
