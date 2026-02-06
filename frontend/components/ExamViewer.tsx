"use client";
import React, { useEffect, useState } from 'react';

type Answer = {
  id: number;
  text: string;
};

type Question = {
  id: number;
  number: number;
  part: string | null;
  text: string;
  type: string;
  image: string | null;
  options: string[];
  answers: Answer[];
};

type Exam = {
  id: number;
  url: string;
  name: string;
  subject: string;
  createdAt: string;
  questions: Question[];
};

type ExamViewerProps = {
  examId: number;
};

type UserAnswer = {
  questionId: number;
  answer: string;
};

export default function ExamViewer({ examId }: ExamViewerProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Map<number, string>>(new Map());
  const [checkedQuestions, setCheckedQuestions] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchExam() {
      try {
        setLoading(true);
        const res = await fetch(`/api/exams/${examId}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Exam not found' : 'Failed to fetch exam');
        }
        const data = await res.json();
        if (mounted) {
          // Sort questions by number and part
          const sortedQuestions = [...(data.questions || [])].sort((a, b) => {
            if (a.number !== b.number) {
              return a.number - b.number;
            }
            // If numbers are equal, sort by part (null comes first)
            if (a.part === null) return -1;
            if (b.part === null) return 1;
            return a.part.localeCompare(b.part);
          });
          setExam({ ...data, questions: sortedQuestions });
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to load exam', err);
        if (mounted) setError(err?.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchExam();

    return () => {
      mounted = false;
    };
  }, [examId]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setUserAnswers(prev => {
      const newAnswers = new Map(prev);
      newAnswers.set(questionId, answer);
      return newAnswers;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Here you would typically submit answers to an API
      // For now, we'll just simulate a submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit exam', err);
      alert('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckAnswer = (questionId: number) => {
    setCheckedQuestions(prev => {
      const newChecked = new Set(prev);
      newChecked.add(questionId);
      return newChecked;
    });
  };

  const getCorrectAnswer = (question: Question): string | null => {
    if (question.answers && question.answers.length > 0) {
      return question.answers[0].text;
    }
    return null;
  };

  const isAnswerCorrect = (question: Question, userAnswer: string): boolean => {
    const correctAnswer = getCorrectAnswer(question);
    if (!correctAnswer) return false;
    return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  };

  const getQuestionLabel = (question: Question): string => {
    return question.part ? `${question.number}${question.part}` : `${question.number}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg text-gray-600">Loading exam...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-8">
        <div className="text-gray-600">No exam found.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">Exam Submitted Successfully!</h2>
          <p>Your answers have been recorded.</p>
          <div className="mt-4">
            <p className="text-sm text-green-600">
              Questions answered: {userAnswers.size} / {exam.questions.length}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-black">{exam.name}</h1>
        <div className="text-gray-600">
          <span className="font-semibold">Subject:</span> {exam.subject}
        </div>
        <div className="text-gray-500 text-sm mt-1">
          {exam.questions.length} question{exam.questions.length !== 1 ? 's' : ''}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {exam.questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                {getQuestionLabel(question)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    {question.type}
                  </span>
                </div>
                <p className="text-gray-800 text-lg">{question.text}</p>
                {question.image && (
                  <div className="mt-3">
                    <img
                      src={question.image}
                      alt={`Question ${getQuestionLabel(question)} diagram`}
                      className="max-w-full h-auto rounded border border-gray-300"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="ml-15 mt-4">
              {question.type === 'MCQ' && question.options.length > 0 ? (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const isChecked = checkedQuestions.has(question.id);
                    const userAnswer = userAnswers.get(question.id);
                    const correctAnswer = getCorrectAnswer(question);
                    const isSelected = userAnswer === option;
                    const isCorrectOption = correctAnswer === option;
                    
                    let optionClasses = "flex items-center gap-3 p-3 rounded border transition-colors";
                    
                    if (isChecked) {
                      if (isCorrectOption) {
                        optionClasses += " bg-green-100 border-green-500";
                      } else if (isSelected && !isCorrectOption) {
                        optionClasses += " bg-red-100 border-red-500";
                      } else {
                        optionClasses += " border-gray-200";
                      }
                    } else {
                      optionClasses += " border-gray-200 hover:bg-gray-50 cursor-pointer";
                    }
                    
                    return (
                      <label
                        key={optionIndex}
                        className={optionClasses}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={isSelected}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          disabled={isChecked}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700 flex-1">{option}</span>
                        {isChecked && isCorrectOption && (
                          <span className="text-green-700 font-semibold text-sm">✓ Correct</span>
                        )}
                        {isChecked && isSelected && !isCorrectOption && (
                          <span className="text-red-700 font-semibold text-sm">✗ Wrong</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <>
                  <textarea
                    value={userAnswers.get(question.id) || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Type your answer here..."
                    disabled={checkedQuestions.has(question.id)}
                    className="w-full min-h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-black disabled:bg-gray-50"
                    data-testid={`answer-input-${question.id}`}
                  />
                  {checkedQuestions.has(question.id) && getCorrectAnswer(question) && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Correct Answer:</p>
                      <p className="text-blue-800">{getCorrectAnswer(question)}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {!checkedQuestions.has(question.id) && (
              <div className="ml-15 mt-4">
                <button
                  type="button"
                  onClick={() => handleCheckAnswer(question.id)}
                  disabled={!userAnswers.has(question.id)}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  data-testid={`check-answer-${question.id}`}
                >
                  Check Answer
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-sm text-gray-600">
            Questions answered: {userAnswers.size} / {exam.questions.length}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </form>
    </div>
  );
}
