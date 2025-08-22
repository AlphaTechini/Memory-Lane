class ContextManager {
  constructor() {
    this.history = [];
  }

  addMessage(role, content) {
    this.history.push({ role, content });
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
    console.log('Conversation history cleared.');
  }

  /**
   * Resets the conversation history.
   */
  reset() {
    this.clearHistory();
  }
}

module.exports = ContextManager;
