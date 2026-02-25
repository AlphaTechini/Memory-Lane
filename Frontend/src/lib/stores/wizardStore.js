import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { REQUIRED_QUESTIONS, getAllOptionalQuestions, getRequiredQuestionsByTemplate } from '../questionBank.js';

// Storage key
const STORAGE_KEY = 'replica_wizard_state';

// Initial state
function createInitialState() {
  return {
    // Current step
    currentStep: 0,

    // Template info
    template: null,
    relationship: null,

    // Basic info
    basics: {
      name: '',
      description: '',
      greeting: '',
      preferredQuestion: '',
      consent: false
    },

    // Creation Path (questionnaire vs upload)
    creationPath: 'questionnaire',

    // Uploaded File Info (if path is upload)
    uploadedFileInfo: null,

    // Answers
    requiredAnswers: {},
    optionalAnswers: {},

    // Selected segments
    selectedSegments: [],

    // Profile image
    profileImage: null,

    // Knowledge Base (NEW - Step 7)
    knowledgeBase: {
      entries: [],
      currentEntry: {
        title: '',
        text: '',
        url: '',
        filename: '',
        autoRefresh: false,
        inputType: 'text' // 'text', 'url', 'file'
      }
    },

    // UI state
    loading: false,
    error: '',

    // Submission state
    replicaId: null,
    trainingStatus: null,

    // Submission progress persistence for retry flow
    submissionProgress: {
      steps: [],
      message: '',
      showProgress: false,
      submitError: null,
      lastFailedStep: null,
      baselineReplicaIds: [],
      recoveredReplica: null
    }
  };
}

// Load initial state from localStorage
function loadInitialState() {
  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedState = JSON.parse(saved);
        const mergedState = { ...createInitialState(), ...parsedState };
        if (typeof mergedState.currentStep === 'number') {
          mergedState.currentStep = Math.max(0, Math.min(mergedState.currentStep, 6));
        }
        return mergedState;
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
  const template = $state.template;
  const requiredQuestions = template ? getRequiredQuestionsByTemplate(template) : REQUIRED_QUESTIONS;

  const requiredCount = Object.keys($state.requiredAnswers).length;
  const requiredTotal = requiredQuestions.length;
  const requiredScore = (requiredCount / requiredTotal) * 70; // 70% weight for required

  const optionalCount = Object.keys($state.optionalAnswers).length;
  const minOptionalRequired = 40;
  const optionalScore = Math.min(optionalCount / minOptionalRequired, 1) * 30; // 30% weight for optional

  return Math.round(requiredScore + optionalScore);
});

// Store actions
export const wizardStore = {
  subscribe: state.subscribe,

  // Get current state synchronously
  getState: () => {
    let currentState;
    state.subscribe(value => {
      currentState = value;
    })();
    return currentState;
  },

  // Helper functions
  canProceedToStep: (step, $state) => {
    switch (step) {
      case 2:
        return $state.basics?.name?.trim() &&
          $state.basics?.description?.trim() &&
          $state.basics?.description?.trim().length <= 50 &&
          $state.basics?.consent;
      case 3: {
        if ($state.creationPath === 'upload') return true;
        const template = $state.template;
        const requiredQuestions = template ? getRequiredQuestionsByTemplate(template) : REQUIRED_QUESTIONS;
        return Object.keys($state.requiredAnswers).length === requiredQuestions.length;
      }
      case 4:
        if ($state.creationPath === 'upload') return true;
        return $state.selectedSegments.length > 0;
      case 5:
        // Optional questions can be skipped - always allow proceeding to profile image
        return true;
      case 6:
        // Profile image is optional - allow proceeding to review
        return true;
      default:
        return true;
    }
  },

  isStepValid: (step, $state) => {
    switch (step) {
      case 1:
        const baseValid = $state.basics?.name?.trim() &&
          $state.basics?.description?.trim() &&
          $state.basics?.description?.trim().length <= 50 &&
          $state.basics?.consent;
        if (!baseValid) return false;
        if ($state.creationPath === 'upload' && !$state.uploadedFileInfo) return false;
        return true;
      case 2: {
        if ($state.creationPath === 'upload') return true;
        const template = $state.template;
        const requiredQuestions = template ? getRequiredQuestionsByTemplate(template) : REQUIRED_QUESTIONS;
        return Object.keys($state.requiredAnswers).length === requiredQuestions.length &&
          requiredQuestions.every(q => {
            const answer = $state.requiredAnswers[q.id];
            // Some templates/questions may not define minLength — treat missing minLength as 0
            const minLen = typeof q.minLength === 'number' ? q.minLength : 0;
            return answer && answer.trim().length >= minLen;
          });
      }
      case 3:
        if ($state.creationPath === 'upload') return true;
        return $state.selectedSegments.length > 0;
      case 4:
        // Optional questions can be skipped - always allow proceeding
        return true;
      case 5:
        // Profile image is optional - allow proceeding without it
        return true;
      case 6: {
        if ($state.creationPath === 'upload') return true;
        const template = $state.template;
        const requiredQuestions = template ? getRequiredQuestionsByTemplate(template) : REQUIRED_QUESTIONS;
        const requiredCount = Object.keys($state.requiredAnswers).length;
        const requiredTotal = requiredQuestions.length;
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
        greeting: data.greeting !== undefined ? data.greeting : s.basics.greeting,
        preferredQuestion: data.preferredQuestion !== undefined ? data.preferredQuestion : s.basics.preferredQuestion,
        consent: data.consent !== undefined ? data.consent : s.basics.consent
      }
    }));
  },

  setCreationPath: (path) => {
    state.update(s => ({ ...s, creationPath: path }));
  },

  setUploadedFileInfo: (info) => {
    state.update(s => ({ ...s, uploadedFileInfo: info }));
  },

  // Template actions
  updateTemplate: (template, relationship) => {
    state.update(s => ({
      ...s,
      template,
      relationship
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
      currentStep: Math.max(0, Math.min(step, 6))
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

  setSubmissionProgress: (progress) => {
    state.update(s => ({
      ...s,
      submissionProgress: {
        ...s.submissionProgress,
        ...progress
      }
    }));
  },

  updateSubmissionProgress: (updater) => {
    state.update(s => {
      const current = s.submissionProgress || createInitialState().submissionProgress;
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return {
        ...s,
        submissionProgress: next
      };
    });
  },

  clearSubmissionProgress: () => {
    state.update(s => ({
      ...s,
      submissionProgress: createInitialState().submissionProgress
    }));
  },

  // Knowledge Base Actions
  updateKnowledgeBaseEntry: (field, value) => {
    state.update(s => ({
      ...s,
      knowledgeBase: {
        ...s.knowledgeBase,
        currentEntry: {
          ...s.knowledgeBase.currentEntry,
          [field]: value
        }
      }
    }));
  },

  addKnowledgeBaseEntry: (entry) => {
    state.update(s => ({
      ...s,
      knowledgeBase: {
        ...s.knowledgeBase,
        entries: [...s.knowledgeBase.entries, { ...entry, id: Date.now() }],
        currentEntry: {
          title: '',
          text: '',
          url: '',
          filename: '',
          autoRefresh: false,
          inputType: 'text'
        }
      }
    }));
  },

  removeKnowledgeBaseEntry: (id) => {
    state.update(s => ({
      ...s,
      knowledgeBase: {
        ...s.knowledgeBase,
        entries: s.knowledgeBase.entries.filter(entry => entry.id !== id)
      }
    }));
  },

  clearKnowledgeBaseForm: () => {
    state.update(s => ({
      ...s,
      knowledgeBase: {
        ...s.knowledgeBase,
        currentEntry: {
          title: '',
          text: '',
          url: '',
          filename: '',
          autoRefresh: false,
          inputType: 'text'
        }
      }
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
          const mergedState = { ...createInitialState(), ...parsedState };
          if (typeof mergedState.currentStep === 'number') {
            mergedState.currentStep = Math.max(0, Math.min(mergedState.currentStep, 6));
          }
          state.set(mergedState);
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
  },

  calculateCoverageScore: () => {
    let currentCoverage = 0;
    coverageScore.subscribe(value => {
      currentCoverage = value;
    })();
    return currentCoverage;
  }
};
