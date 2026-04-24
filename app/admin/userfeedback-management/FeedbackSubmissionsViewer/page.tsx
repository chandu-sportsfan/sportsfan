"use client";

import { useState, useEffect } from "react";
import { Eye, CheckCircle, XCircle,  Download } from "lucide-react";
import axios from "axios";

interface Submission {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    answers: Array<{
        questionId: string;
        answer: string | string[] | number;
        questionDetails?: {
            question: string;
            type: string;
        };
    }>;
    textFeedback: string;
    attachments: string[];
    pageUrl: string;
    userAgent: string;
    status: 'pending' | 'reviewed' | 'resolved';
    createdAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
    notes?: string;
}

export default function FeedbackSubmissionsViewer() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [filter, setFilter] = useState('all');
    const [stats, setStats] = useState({
        totalSubmissions: 0,
        pendingSubmissions: 0,
        reviewedSubmissions: 0,
        resolvedSubmissions: 0,
        averageRating: 0,
    });

    useEffect(() => {
        fetchSubmissions();
        fetchStats();
    }, [filter]);

    const fetchSubmissions = async () => {
        try {
            const response = await axios.get(`/api/feedback/submissions?status=${filter !== 'all' ? filter : ''}`);
            if (response.data.success) {
                setSubmissions(response.data.submissions);
            }
        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get('/api/feedback/stats');
            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await axios.put('/api/feedback/submissions', {
                id,
                status,
                reviewedBy: 'Admin',
                reviewedAt: Date.now(),
            });
            fetchSubmissions();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const deleteSubmission = async (id: string) => {
        if (confirm('Are you sure you want to delete this submission?')) {
            try {
                await axios.delete(`/api/feedback/submissions?id=${id}`);
                fetchSubmissions();
            } catch (error) {
                console.error('Error deleting submission:', error);
            }
        }
    };

    const exportToCSV = () => {
        const headers = ['Date', 'User', 'Email', 'Status', 'Answers', 'Text Feedback'];
        const rows = submissions.map(sub => [
            new Date(sub.createdAt).toLocaleString(),
            sub.userName,
            sub.userEmail,
            sub.status,
            sub.answers.map(a => `${a.questionDetails?.question}: ${a.answer}`).join('; '),
            sub.textFeedback,
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9115F]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#141414] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Total</p>
                    <p className="text-white text-2xl font-bold">{stats.totalSubmissions}</p>
                </div>
                <div className="bg-[#141414] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Pending</p>
                    <p className="text-yellow-500 text-2xl font-bold">{stats.pendingSubmissions}</p>
                </div>
                <div className="bg-[#141414] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Reviewed</p>
                    <p className="text-blue-500 text-2xl font-bold">{stats.reviewedSubmissions}</p>
                </div>
                <div className="bg-[#141414] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Resolved</p>
                    <p className="text-green-500 text-2xl font-bold">{stats.resolvedSubmissions}</p>
                </div>
                <div className="bg-[#141414] rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Avg Rating</p>
                    <p className="text-purple-500 text-2xl font-bold">{stats.averageRating}</p>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-[#141414] rounded-xl p-4 flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                            filter === 'all' ? 'bg-[#C9115F] text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                            filter === 'pending' ? 'bg-[#C9115F] text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'
                        }`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter('reviewed')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                            filter === 'reviewed' ? 'bg-[#C9115F] text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'
                        }`}
                    >
                        Reviewed
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        className={`px-4 py-2 rounded-lg text-sm transition ${
                            filter === 'resolved' ? 'bg-[#C9115F] text-white' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'
                        }`}
                    >
                        Resolved
                    </button>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] text-white rounded-lg hover:bg-[#2a2a2a] transition"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>

            {/* Submissions List */}
            <div className="space-y-3">
                {submissions.map((submission) => (
                    <div key={submission.id} className="bg-[#141414] rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-white font-medium">{submission.userName}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        submission.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                        submission.status === 'reviewed' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-green-500/20 text-green-400'
                                    }`}>
                                        {submission.status}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-xs">
                                    {new Date(submission.createdAt).toLocaleString()}
                                </p>
                                {submission.userEmail && (
                                    <p className="text-gray-400 text-xs mt-1">{submission.userEmail}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSubmission(submission)}
                                    className="p-2 text-gray-400 hover:text-blue-400 transition"
                                >
                                    <Eye size={18} />
                                </button>
                                {submission.status === 'pending' && (
                                    <button
                                        onClick={() => updateStatus(submission.id, 'reviewed')}
                                        className="p-2 text-gray-400 hover:text-blue-400 transition"
                                    >
                                        <CheckCircle size={18} />
                                    </button>
                                )}
                                {submission.status === 'reviewed' && (
                                    <button
                                        onClick={() => updateStatus(submission.id, 'resolved')}
                                        className="p-2 text-gray-400 hover:text-green-400 transition"
                                    >
                                        <CheckCircle size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteSubmission(submission.id)}
                                    className="p-2 text-gray-400 hover:text-red-400 transition"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Preview of answers */}
                        <div className="space-y-1">
                            {submission.answers.slice(0, 2).map((answer, idx) => (
                                <p key={idx} className="text-gray-300 text-sm">
                                    <span className="text-gray-500">{answer.questionDetails?.question}:</span> {answer.answer}
                                </p>
                            ))}
                            {submission.textFeedback && (
                                <p className="text-gray-300 text-sm mt-2 line-clamp-2">
                                    {submission.textFeedback}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {selectedSubmission && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-[#141414] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-[#141414] border-b border-white/10 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white text-xl font-bold">Feedback Details</h3>
                            <button onClick={() => setSelectedSubmission(null)} className="text-gray-400 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* User Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-400 text-sm">User Name</p>
                                    <p className="text-white font-medium">{selectedSubmission.userName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm">User ID</p>
                                    <p className="text-white font-mono text-sm">{selectedSubmission.userId}</p>
                                </div>
                                {selectedSubmission.userEmail && (
                                    <div>
                                        <p className="text-gray-400 text-sm">Email</p>
                                        <p className="text-white">{selectedSubmission.userEmail}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-gray-400 text-sm">Submitted</p>
                                    <p className="text-white">{new Date(selectedSubmission.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Answers */}
                            <div>
                                <h4 className="text-white font-semibold mb-3">Answers</h4>
                                <div className="space-y-3">
                                    {selectedSubmission.answers.map((answer, idx) => (
                                        <div key={idx} className="bg-[#1e1e1e] rounded-xl p-3">
                                            <p className="text-[#C9115F] text-sm font-medium mb-1">
                                                {answer.questionDetails?.question}
                                            </p>
                                            <p className="text-white">
                                                {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Text Feedback */}
                            {selectedSubmission.textFeedback && (
                                <div>
                                    <h4 className="text-white font-semibold mb-3">Additional Feedback</h4>
                                    <div className="bg-[#1e1e1e] rounded-xl p-4">
                                        <p className="text-gray-300">{selectedSubmission.textFeedback}</p>
                                    </div>
                                </div>
                            )}

                            {/* Attachments */}
                            {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
                                <div>
                                    <h4 className="text-white font-semibold mb-3">Attachments</h4>
                                    <div className="flex gap-2">
                                        {selectedSubmission.attachments.map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1 bg-[#1e1e1e] text-[#C9115F] rounded-lg text-sm hover:bg-[#2a2a2a] transition"
                                            >
                                                Attachment {idx + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>Page URL: {selectedSubmission.pageUrl}</p>
                                <p>User Agent: {selectedSubmission.userAgent}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}