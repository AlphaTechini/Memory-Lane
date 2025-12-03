import { writable } from 'svelte/store';

// Store template-based replica drafts before full wizard submission
function createReplicasStore() {
  const { subscribe, update, set } = writable({ drafts: [] });

  return {
    subscribe,
    addDraft(draft) {
      update(state => {
        state.drafts.push({ ...draft, createdAt: new Date().toISOString() });
        return state;
      });
    },
    clearDrafts() { set({ drafts: [] }); }
  };
}

export const replicasStore = createReplicasStore();
