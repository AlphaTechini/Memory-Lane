// Question bank for replica training - synchronized with frontend
export const REQUIRED_QUESTIONS = [
  { id: 'rq1', text: 'What drives you most in life? Describe your core motivations, values, and what gives your life meaning.' },
  { id: 'rq2', text: 'How do you handle failure and setbacks? Walk me through a time when things didn\'t go as planned and how you dealt with it.' },
  { id: 'rq3', text: 'What are your biggest fears, and how do they influence your decisions and behavior?' },
  { id: 'rq4', text: 'Describe your ideal relationship (romantic, friendship, or family). What do you value most in human connections?' },
  { id: 'rq5', text: 'If you could change one thing about the world, what would it be and why? How would you go about making that change?' },
  { id: 'rq6', text: 'What do you believe happens after death? How does this belief influence how you live your life?' },
  { id: 'rq7', text: 'Describe a moment when you felt most proud of yourself. What did you accomplish and why was it meaningful?' },
  { id: 'rq8', text: 'How do you define success? Has this definition changed over time, and if so, how?' },
  { id: 'rq9', text: 'What\'s your biggest regret, and what have you learned from it? How has it shaped who you are today?' },
  { id: 'rq10', text: 'If you had unlimited resources and time, what would you dedicate your life to? What legacy would you want to leave?' }
];

export const OPTIONAL_SEGMENTS = {
  occupation: {
    name: 'Occupation & Career',
    questions: [
      { id: 'occ1', text: 'What does a typical workday look like for you? Walk me through your daily routine.' },
      { id: 'occ2', text: 'What originally drew you to your current field or profession?' },
      { id: 'occ3', text: 'Describe your biggest professional achievement and what it meant to you.' },
      { id: 'occ4', text: 'What\'s the most challenging aspect of your work, and how do you handle it?' },
      { id: 'occ5', text: 'Where do you see your career heading in the next 5-10 years?' }
    ]
  },
  hobbies: {
    name: 'Hobbies & Interests',
    questions: [
      { id: 'hob1', text: 'What hobby or activity makes you lose track of time?' },
      { id: 'hob2', text: 'How did you discover your main interests or hobbies?' },
      { id: 'hob3', text: 'What\'s something you\'ve always wanted to learn or try?' },
      { id: 'hob4', text: 'Describe your favorite way to spend a free weekend.' },
      { id: 'hob5', text: 'What books, movies, or shows have significantly impacted you?' }
    ]
  },
  viewpoints: {
    name: 'Views & Opinions',
    questions: [
      { id: 'view1', text: 'What\'s a controversial opinion you hold that most people disagree with?' },
      { id: 'view2', text: 'How do you feel about social media and its impact on society?' },
      { id: 'view3', text: 'What\'s your stance on work-life balance and career ambition?' }
    ]
  },
  communication: {
    name: 'Communication Style',
    questions: [
      { id: 'comm1', text: 'How would your closest friends describe your personality?' },
      { id: 'comm2', text: 'What\'s your communication style when you\'re upset or angry?' },
      { id: 'comm3', text: 'How do you prefer to give and receive feedback?' }
    ]
  },
  lifestyle: {
    name: 'Lifestyle & Habits',
    questions: [
      { id: 'life1', text: 'Describe your ideal morning routine.' },
      { id: 'life2', text: 'How do you maintain your physical and mental health?' },
      { id: 'life3', text: 'What does your living space say about you?' }
    ]
  },
  quirks: {
    name: 'Quirks & Personality',
    questions: [
      { id: 'quirk1', text: 'What\'s a weird or unique habit you have that most people don\'t know about?' },
      { id: 'quirk2', text: 'What\'s something that annoys you that most people probably wouldn\'t mind?' },
      { id: 'quirk3', text: 'Describe a superstition or ritual you follow, even if you know it\'s not logical.' }
    ]
  }
  // Add other segments as needed
};

export function getQuestionText(questionId) {
  // Check required questions
  const required = REQUIRED_QUESTIONS.find(q => q.id === questionId);
  if (required) return required.text;
  
  // Check optional questions across all segments
  for (const segment of Object.values(OPTIONAL_SEGMENTS)) {
    const question = segment.questions.find(q => q.id === questionId);
    if (question) return question.text;
  }
  
  return 'Unknown question';
}
