import React from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';

interface FollowUpQuestionsProps {
  questions: string;
  onQuestionClick?: (question: string) => void;
}

const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({ questions, onQuestionClick }) => {
  const questionList = questions.split('\n').filter(q => q.trim().length > 0);

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-4">
      <div className="flex items-center space-x-2 mb-3">
        <HelpCircle size={16} className="text-blue-600" />
        <span className="text-sm font-medium text-blue-800">Follow-up Questions</span>
      </div>
      <div className="space-y-2">
        {questionList.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick?.(question.trim())}
            className="w-full text-left p-3 rounded-lg bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 group-hover:text-blue-700 pr-2">
                {question.trim()}
              </span>
              <ArrowRight size={14} className="text-blue-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FollowUpQuestions;
