"use client";

import { useState } from "react";
import FeedbackQuestionsManager from "../FeedbackQuestionsManager/page";
import FeedbackSubmissionsViewer from "../FeedbackSubmissionsViewer/page";



export default function AdminFeedbackPage() {
    const [activeTab, setActiveTab] = useState<'questions' | 'submissions'>('questions');

    return (
        <div className="min-h-screen bg-[#0d0d10] p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-white text-3xl font-bold mb-6">Feedback Management</h1>
                
                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`px-6 py-3 text-sm font-medium transition ${
                            activeTab === 'questions'
                                ? 'text-[#C9115F] border-b-2 border-[#C9115F]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Manage Questions
                    </button>
                    <button
                        onClick={() => setActiveTab('submissions')}
                        className={`px-6 py-3 text-sm font-medium transition ${
                            activeTab === 'submissions'
                                ? 'text-[#C9115F] border-b-2 border-[#C9115F]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        View Submissions
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'questions' ? (
                    <FeedbackQuestionsManager />
                ) : (
                    <FeedbackSubmissionsViewer />
                )}
            </div>
        </div>
    );
}