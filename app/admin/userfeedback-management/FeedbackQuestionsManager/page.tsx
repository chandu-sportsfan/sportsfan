"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff,  X } from "lucide-react";
import axios from "axios";

interface Question {
    id: string;
    question: string;
    type: 'rating' | 'radio' | 'checkbox' | 'text';
    options: string[];
    required: boolean;
    order: number;
    isActive: boolean;
    createdAt: number;
}

export default function FeedbackQuestionsManager() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [formData, setFormData] = useState({
        question: '',
        type: 'rating' as Question['type'],
        options: ['1', '2', '3', '4', '5'],
        required: true,
        isActive: true,
    });
    const [optionInput, setOptionInput] = useState('');

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            const response = await axios.get('/api/feedback/questions');
            if (response.data.success) {
                setQuestions(response.data.questions);
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            if (editingQuestion) {
                await axios.put('/api/feedback/questions', {
                    id: editingQuestion.id,
                    ...formData,
                });
            } else {
                await axios.post('/api/feedback/questions', formData);
            }
            fetchQuestions();
            closeModal();
        } catch (error) {
            console.error('Error saving question:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this question?')) {
            try {
                await axios.delete(`/api/feedback/questions?id=${id}`);
                fetchQuestions();
            } catch (error) {
                console.error('Error deleting question:', error);
            }
        }
    };

    const handleToggleActive = async (question: Question) => {
        try {
            await axios.put('/api/feedback/questions', {
                id: question.id,
                isActive: !question.isActive,
            });
            fetchQuestions();
        } catch (error) {
            console.error('Error toggling question status:', error);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingQuestion(null);
        setFormData({
            question: '',
            type: 'rating',
            options: ['1', '2', '3', '4', '5'],
            required: true,
            isActive: true,
        });
        setOptionInput('');
    };

    const openModal = (question?: Question) => {
        if (question) {
            setEditingQuestion(question);
            setFormData({
                question: question.question,
                type: question.type,
                options: question.options,
                required: question.required,
                isActive: question.isActive,
            });
        }
        setShowModal(true);
    };

    const addOption = () => {
        if (optionInput.trim()) {
            setFormData({
                ...formData,
                options: [...formData.options, optionInput.trim()],
            });
            setOptionInput('');
        }
    };

    const removeOption = (index: number) => {
        setFormData({
            ...formData,
            options: formData.options.filter((_, i) => i !== index),
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9115F]"></div>
            </div>
        );
    }

    return (
        <div className="bg-[#141414] rounded-2xl p-6 min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-white text-xl font-bold">Feedback Questions</h2>
                    <p className="text-gray-400 text-sm mt-1">Manage your feedback form questions</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9115F] to-[#e85d04] text-white rounded-lg hover:opacity-90 transition"
                >
                    <Plus size={18} />
                    Add Question
                </button>
            </div>

            <div className="space-y-3">
                {questions.map((question, index) => (
                    <div
                        key={index}
                        className="bg-[#1e1e1e] rounded-xl p-4 flex items-center gap-4 hover:bg-[#252525] transition"
                    >
                        <div className="text-gray-500 cursor-move">
                            <GripVertical size={18} />
                        </div>
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    question.type === 'rating' ? 'bg-purple-500/20 text-purple-400' :
                                    question.type === 'radio' ? 'bg-blue-500/20 text-blue-400' :
                                    question.type === 'checkbox' ? 'bg-green-500/20 text-green-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {question.type.toUpperCase()}
                                </span>
                                {!question.isActive && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                        INACTIVE
                                    </span>
                                )}
                            </div>
                            <p className="text-white font-medium">{question.question}</p>
                            {question.options.length > 0 && (
                                <div className="flex gap-2 mt-2">
                                    {question.options.map((option, i) => (
                                        <span key={i} className="text-xs text-gray-400 bg-[#0d0d10] px-2 py-0.5 rounded">
                                            {option}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleToggleActive(question)}
                                className="p-2 text-gray-400 hover:text-white transition"
                            >
                                {question.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                            <button
                                onClick={() => openModal(question)}
                                className="p-2 text-gray-400 hover:text-blue-400 transition"
                            >
                                <Edit size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(question.id)}
                                className="p-2 text-gray-400 hover:text-red-400 transition"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#141414] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-[#141414] border-b border-white/10 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white text-xl font-bold">
                                {editingQuestion ? 'Edit Question' : 'Add Question'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Question Text */}
                            <div>
                                <label className="text-white text-sm font-medium block mb-2">
                                    Question Text *
                                </label>
                                <textarea
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    rows={3}
                                    className="w-full bg-[#0d0d10] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-[#C9115F]/50"
                                    placeholder="Enter your question here..."
                                />
                            </div>

                            {/* Question Type */}
                            <div>
                                <label className="text-white text-sm font-medium block mb-2">
                                    Question Type *
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['rating', 'radio', 'checkbox', 'text'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setFormData({
                                                    ...formData,
                                                    type,
                                                    options: type === 'rating' ? ['1', '2', '3', '4', '5'] : formData.options,
                                                });
                                            }}
                                            className={`px-4 py-2 rounded-lg capitalize transition ${
                                                formData.type === type
                                                    ? 'bg-[#C9115F] text-white'
                                                    : 'bg-[#1e1e1e] text-gray-400 hover:bg-[#2a2a2a]'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Options (for rating, radio, checkbox) */}
                            {(formData.type === 'radio' || formData.type === 'checkbox') && (
                                <div>
                                    <label className="text-white text-sm font-medium block mb-2">
                                        Options *
                                    </label>
                                    <div className="space-y-2">
                                        {formData.options.map((option, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => {
                                                        const newOptions = [...formData.options];
                                                        newOptions[index] = e.target.value;
                                                        setFormData({ ...formData, options: newOptions });
                                                    }}
                                                    className="flex-1 bg-[#0d0d10] text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-[#C9115F]/50"
                                                />
                                                <button
                                                    onClick={() => removeOption(index)}
                                                    className="p-2 text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={optionInput}
                                                onChange={(e) => setOptionInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addOption()}
                                                placeholder="Add option..."
                                                className="flex-1 bg-[#0d0d10] text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-[#C9115F]/50"
                                            />
                                            <button
                                                onClick={addOption}
                                                className="px-4 py-2 bg-[#1e1e1e] text-white rounded-lg hover:bg-[#2a2a2a]"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between">
                                <label className="text-white text-sm font-medium">Required Question</label>
                                <button
                                    onClick={() => setFormData({ ...formData, required: !formData.required })}
                                    className={`relative w-11 h-6 rounded-full transition ${
                                        formData.required ? 'bg-[#C9115F]' : 'bg-gray-600'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                                        formData.required ? 'right-1' : 'left-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between">
                                <label className="text-white text-sm font-medium">Active</label>
                                <button
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`relative w-11 h-6 rounded-full transition ${
                                        formData.isActive ? 'bg-[#C9115F]' : 'bg-gray-600'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                                        formData.isActive ? 'right-1' : 'left-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!formData.question.trim()}
                                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9115F] to-[#e85d04] text-white font-semibold hover:opacity-90 disabled:opacity-50"
                                >
                                    {editingQuestion ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}