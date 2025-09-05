import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { REQUIRED_QUESTIONS, getAllOptionalQuestions } from '../questionBank.js';

// Storage key
const STORAGE_KEY = 'replica_wizard_state';

// Initial state
function createInitialState() {
  return {
    // Current step
    currentStep: 1,
    
    // Basic info
    basics: {
      name: '',
      description: '',
      consent: false
    },
    
    // Answers
    requiredAnswers: {},
    optionalAnswers: {},
    
    // Selected segments
    selectedSegments: [],
    
    // Profile image
    profileImage: null,
    
    // UI state
    loading: false,
    error: '',
    
    // Submission state
    replicaId: null,
    trainingStatus: null
  };
}

// Load initial state from localStorage
function loadInitialState() {
  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedState = JSON.parse(saved);
        return { ...createInitialState(), ...parsedState };
      } catch (e) {
        console.warn('Failed to load wizard state from localStorage:', e);
      }
    }
  }
  return createInitialState();
}

// Create the main state store
const state = writable(loadInitialState());

// Auto-save to localStorage
function saveToStorage(stateValue) {
  if (browser) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateValue));
    } catch (e) {
      console.warn('Failed to save wizard state to localStorage:', e);
    }
  }
}

// Subscribe to state changes and auto-save
state.subscribe((value) => {
  saveToStorage(value);
});

// Derived stores for computed properties
export const coverageScore = derived(state, ($state) => {
  const requiredCount = Object.keys($state.requiredAnswers).length;
  const requiredTotal = REQUIRED_QUESTIONS.length;
  const requiredScore = (requiredCount / requiredTotal) * 70; // 70% weight for required
  
  const optionalCount = Object.keys($state.optionalAnswers).length;
  const minOptionalRequired = 40;
  const optionalScore = Math.min(optionalCount / minOptionalRequired, 1) * 30; // 30% weight for optional
  
  return Math.round(requiredScore + optionalScore);
});

// Store actions
export const wizardStore = {
  subscribe: state.subscribe,
  
  // Helper functions
  canProceedToStep: (step, $state) => {
    switch (step) {
      case 2:
        return $state.basics?.name?.trim() && $state.basics?.description?.trim() && $state.basics?.consent;
      case 3:
        return Object.keys($state.requiredAnswers).length === REQUIRED_QUESTIONS.length;
      case 4:
        return $state.selectedSegments.length > 0;
      case 5:
        return Object.keys($state.optionalAnswers).length >= 40;
      case 6:
        return $state.profileImage;
      default:
        return true;
    }
  },
  
  isStepValid: (step, $state) => {
    switch (step) {
      case 1:
        return $state.basics?.name?.trim() && $state.basics?.description?.trim() && $state.basics?.consent;
      case 2:
        return Object.keys($state.requiredAnswers).length === REQUIRED_QUESTIONS.length &&
               REQUIRED_QUESTIONS.every(q => {
                 const answer = $state.requiredAnswers[q.id];
                 return answer && answer.trim().length >= q.minLength;
               });
      case 3:
        return $state.selectedSegments.length > 0;
      case 4:
        return Object.keys($state.optionalAnswers).length >= 40 &&
               Object.values($state.optionalAnswers).every(answer => 
                 answer && answer.trim().length >= 120
               );
      case 5:
        return $state.profileImage;
      case 6: {
        const requiredCount = Object.keys($state.requiredAnswers).length;
        const requiredTotal = REQUIRED_QUESTIONS.length;
        const requiredScore = (requiredCount / requiredTotal) * 70;
        const optionalCount = Object.keys($state.optionalAnswers).length;
        const minOptionalRequired = 40;
        const optionalScore = Math.min(optionalCount / minOptionalRequired, 1) * 30;
        const coverage = Math.round(requiredScore + optionalScore);
        return coverage >= 70;
      }
      default:
        return false;
    }
  },
  
  // Actions
  updateBasics: (data) => {
    state.update(s => ({
      ...s,
      basics: {
        ...s.basics,
        name: data.name !== undefined ? data.name : s.basics.name,
        description: data.description !== undefined ? data.description : s.basics.description,
        consent: data.consent !== undefined ? data.consent : s.basics.consent
      }
    }));
  },
  
  updateRequiredAnswer: (questionId, answer) => {
    state.update(s => ({
      ...s,
      requiredAnswers: {
        ...s.requiredAnswers,
        [questionId]: answer
      }
    }));
  },
  
  updateOptionalAnswer: (questionId, answer) => {
    state.update(s => {
      const newAnswers = { ...s.optionalAnswers };
      if (answer && answer.trim()) {
        newAnswers[questionId] = answer;
      } else {
        delete newAnswers[questionId];
      }
      return {
        ...s,
        optionalAnswers: newAnswers
      };
    });
  },
  
  updateSelectedSegments: (segments) => {
    state.update(s => {
      // Clear optional answers for unselected segments
      const allOptionalQuestions = getAllOptionalQuestions();
      const selectedQuestionIds = new Set(
        allOptionalQuestions
          .filter(q => segments.includes(q.segment))
          .map(q => q.id)
      );
      
      const newOptionalAnswers = {};
      Object.keys(s.optionalAnswers).forEach(questionId => {
        if (selectedQuestionIds.has(questionId)) {
          newOptionalAnswers[questionId] = s.optionalAnswers[questionId];
        }
      });
      
      return {
        ...s,
        selectedSegments: segments,
        optionalAnswers: newOptionalAnswers
      };
    });
  },
  
  updateProfileImage: (imageData) => {
    state.update(s => ({
      ...s,
      profileImage: imageData
    }));
  },
  
  setCurrentStep: (step) => {
    state.update(s => ({
      ...s,
      currentStep: step
    }));
  },
  
  nextStep: () => {
    state.update(s => ({
      ...s,
      currentStep: Math.min(s.currentStep + 1, 6)
    }));
  },
  
  previousStep: () => {
    state.update(s => ({
      ...s,
      currentStep: Math.max(s.currentStep - 1, 1)
    }));
  },
  
  setLoading: (loading) => {
    state.update(s => ({
      ...s,
      loading
    }));
  },
  
  setError: (error) => {
    state.update(s => ({
      ...s,
      error
    }));
  },
  
  setReplicaId: (id) => {
    state.update(s => ({
      ...s,
      replicaId: id
    }));
  },
  
  setTrainingStatus: (status) => {
    state.update(s => ({
      ...s,
      trainingStatus: status
    }));
  },
  
  reset: () => {
    state.set(createInitialState());
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  
  loadFromStorage: () => {
    if (browser) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          state.set({ ...createInitialState(), ...parsedState });
        } catch (e) {
          console.warn('Failed to load wizard state from localStorage:', e);
        }
      }
    }
  },
  
  clearStorage: () => {
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
};
