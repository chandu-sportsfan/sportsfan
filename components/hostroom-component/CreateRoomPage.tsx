"use client";

import { useEffect } from "react";
import { useRoom } from "../../context/RoomContext";
import Step1RoomTypeForm from "./Step1RoomTypeForm";
import Step2DetailsForm from "./Step2DetailsForm";
import Step3MediaForm from "./Step3MediaForm";
import Step4PriceForm from "./Step4PriceForm";

const STEPS = [
    { number: 1, label: "Room Type",  description: "Choose type & event" },
    { number: 2, label: "Details",    description: "Title, capacity, tags" },
    { number: 3, label: "Media",      description: "Upload assets" },
    { number: 4, label: "Price",      description: "Set price & publish" },
];

/*──────────────────────────────────────────────
  INNER (consumes context)
──────────────────────────────────────────────*/

function CreateRoomInner({ editId }: { editId?: string }) {
    const {
        currentStep,
        setCurrentStep,
        room,
        roomId,
        createRoom,
        updateRoom,
        fetchRoom,
        loading,
    } = useRoom();

    /* Load existing room when editing */
    useEffect(() => {
        if (editId) fetchRoom(editId);
    }, [editId, fetchRoom]);

    /* Step navigation with auto-save */
    const handleNext = async () => {
        if (currentStep === 1) {
            if (!room.hostId || !room.eventId || !room.roomType) {
                alert("Host ID, Event, and Room Type are required.");
                return;
            }

            if (!roomId) {
                /* Create draft room */
                const newId = await createRoom({
                    hostId: room.hostId,
                    eventId: room.eventId,
                    roomType: room.roomType,
                    status: "draft",
                });
                if (!newId) {
                    alert("Failed to create room. Please try again.");
                    return;
                }
            } else {
                await updateRoom(roomId, {
                    hostId: room.hostId,
                    eventId: room.eventId,
                    roomType: room.roomType,
                });
            }
        }

        if (currentStep === 2) {
            if (!roomId) {
                alert("Please complete Step 1 first.");
                return;
            }
            await updateRoom(roomId, {
                title: room.title,
                description: room.description,
                thumbnail: room.thumbnail,
                capacity: room.capacity,
                language: room.language,
                tags: room.tags,
                scheduledAt: room.scheduledAt,
                moderators: room.moderators,
            });
        }

        /* Step 3 saves via the media API directly — no aggregated save needed */

        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const isLastStep = currentStep === STEPS.length;

    return (
        <div className="max-w-[1440px] mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-xl font-semibold text-white">
                    {editId ? "Edit Room" : "Create Room"}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                    {editId
                        ? "Update room details across all steps"
                        : "Set up your room in 4 steps"}
                </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center mb-8 gap-0">
                {STEPS.map((step, i) => {
                    const isActive = currentStep === step.number;
                    const isDone = currentStep > step.number;
                    return (
                        <div key={step.number} className="flex items-center flex-1 last:flex-none">
                            <button
                                onClick={() => isDone && setCurrentStep(step.number)}
                                className={`flex items-center gap-3 ${isDone ? "cursor-pointer" : "cursor-default"}`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                                        isDone
                                            ? "bg-blue-600 text-white"
                                            : isActive
                                            ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                                            : "bg-[#21262d] text-gray-600 border border-[#30363d]"
                                    }`}
                                >
                                    {isDone ? "✓" : step.number}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className={`text-xs font-semibold ${isActive ? "text-white" : isDone ? "text-gray-400" : "text-gray-600"}`}>
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-gray-600">{step.description}</p>
                                </div>
                            </button>
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-px mx-3 ${isDone ? "bg-blue-600" : "bg-[#21262d]"}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Form Card */}
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6 mb-6">
                <h2 className="text-sm font-semibold text-white mb-6 pb-4 border-b border-[#21262d]">
                    Step {currentStep} — {STEPS[currentStep - 1].label}
                </h2>

                {currentStep === 1 && <Step1RoomTypeForm />}
                {currentStep === 2 && <Step2DetailsForm />}
                {currentStep === 3 && <Step3MediaForm />}
                {currentStep === 4 && <Step4PriceForm />}
            </div>

            {/* Navigation */}
            {!isLastStep && (
                <div className="flex justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#21262d] text-gray-300 hover:bg-[#30363d] disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        ← Back
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {loading ? "Saving…" : "Next →"}
                    </button>
                </div>
            )}

            {isLastStep && currentStep > 1 && (
                <button
                    onClick={handleBack}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#21262d] text-gray-300 hover:bg-[#30363d] transition"
                >
                    ← Back
                </button>
            )}
        </div>
    );
}

// Add default export at the bottom
export default CreateRoomInner;