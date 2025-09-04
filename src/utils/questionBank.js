// Question bank for replica training
export const REQUIRED_QUESTIONS = [
  { id: 'req_1', text: 'What are your core values and principles that guide your decisions?' },
  { id: 'req_2', text: 'How do you handle stress and challenging situations?' },
  { id: 'req_3', text: 'What motivates you and drives your passion in life?' },
  { id: 'req_4', text: 'How do you approach learning and personal growth?' },
  { id: 'req_5', text: 'What does success mean to you personally?' },
  { id: 'req_6', text: 'How do you maintain relationships and connect with others?' },
  { id: 'req_7', text: 'What are your thoughts on life purpose and meaning?' },
  { id: 'req_8', text: 'How do you make important life decisions?' },
  { id: 'req_9', text: 'What legacy do you want to leave behind?' },
  { id: 'req_10', text: 'How has your life experiences shaped who you are today?' }
];

export const OPTIONAL_SEGMENTS = {
  occupation: {
    name: 'Occupation & Career',
    questions: [
      { id: 'occ_1', text: 'What does a typical day at work look like for you?' },
      { id: 'occ_2', text: 'What skills do you consider most important in your field?' },
      { id: 'occ_3', text: 'How do you handle workplace challenges and conflicts?' }
      // Add more as needed
    ]
  },
  hobbies: {
    name: 'Hobbies & Interests',
    questions: [
      { id: 'hob_1', text: 'What hobbies or activities bring you the most joy?' },
      { id: 'hob_2', text: 'How did you discover your main interests?' },
      { id: 'hob_3', text: 'What new skills or hobbies would you like to explore?' }
      // Add more as needed
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
