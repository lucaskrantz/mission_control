import { ContainerStats, Group } from '../types';

/**
 * Aggregate containers into groups based on their group field
 */
export function groupContainers(containers: ContainerStats[]): Group[] {
  const groupMap = new Map<string, ContainerStats[]>();
  
  // Group containers by their group key
  containers.forEach(container => {
    const key = container.group;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(container);
  });
  
  // Convert to Group objects
  const groups: Group[] = [];
  groupMap.forEach((containers, key) => {
    const dominantState = getDominantState(containers);
    groups.push({
      key,
      title: formatGroupTitle(key),
      containers,
      dominantState,
    });
  });
  
  return groups;
}

/**
 * Determine the dominant state of a group
 */
function getDominantState(containers: ContainerStats[]): 'running' | 'paused' | 'exited' | 'restarting' {
  const states = containers.map(c => c.state);
  
  // Priority: running > restarting > paused > exited
  if (states.some(s => s === 'running')) return 'running';
  if (states.some(s => s === 'restarting')) return 'restarting';
  if (states.some(s => s === 'paused')) return 'paused';
  return 'exited';
}

/**
 * Format group key into a readable title
 */
function formatGroupTitle(key: string): string {
  // Capitalize first letter of each word
  return key
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
