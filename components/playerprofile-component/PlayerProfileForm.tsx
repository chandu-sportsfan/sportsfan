"use client";

import axios from "axios";
import { ChangeEvent, useState, useRef } from "react";
import {
    ProfileForm,
    Input,
    Textarea,
    FileInput,
    SectionTitle,
    Divider,
    FormActions,
    getPreview,
} from "./shared";

//  PROPS 

type Props = {
    profileIdToEdit?: string;
    initialForm?: ProfileForm;
    initialAvatar?: string;
    onSaved: (profileId: string) => void;
    onCancel: () => void;
};

//  DEFAULT FORM 

export const defaultProfileForm: ProfileForm = {
    name: "",
    team: "",
    battingStyle: "",
    bowlingStyle: "",
    about: "",
    statsRuns: "",
    statsSr: "",
    statsAvg: "",
    iplDebut: "",
    specialization: "",
    dob: "",
    matches: "",
};

//  COMPONENT 

export default function PlayerProfileForm({
    profileIdToEdit,
    initialForm = defaultProfileForm,
    initialAvatar = "",
    onSaved,
    onCancel,
}: Props) {
    const [form, setForm] = useState<ProfileForm>(initialForm);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    console.log("profileIdToEdit", profileIdToEdit);
    const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const XLSX = await import("xlsx");
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: "binary" });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws);
                    if (data && data.length > 0) {
                        const row: any = data[0];

                        const lowerKeys = Object.keys(row).reduce((acc, k) => {
                            acc[k.toLowerCase()] = String(row[k]);
                            return acc;
                        }, {} as Record<string, string>);

                        const findVal = (...keys: string[]) => {
                            for (const k of keys) {
                                const matched = Object.keys(lowerKeys).find((lk) => lk.includes(k));
                                if (matched) return lowerKeys[matched];
                            }
                            return "";
                        };

                        setForm(prev => ({
                            ...prev,
                            name: findVal("player", "name") || prev.name,
                            team: findVal("team") || prev.team,
                            battingStyle: findVal("bat hand", "batting") || prev.battingStyle,
                            bowlingStyle: findVal("bowl", "bowling type") || prev.bowlingStyle,
                            dob: findVal("age") ? `${findVal("age")} yrs` : prev.dob,
                            statsSr: findVal("strike rate", "sr") || prev.statsSr,
                            statsAvg: findVal("average", "avg") || prev.statsAvg,
                        }));

                        alert("Data extracted successfully!");
                    } else {
                        alert("Excel file is empty");
                    }
                } catch (err) {
                    console.error(err);
                    alert("Failed to parse Excel file");
                }
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            console.error(err);
            alert("Error parsing excel. Make sure xlsx is installed.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!form.name || !form.team) {
            alert("Name and Team are required");
            return;
        }
        setLoading(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (avatarFile) fd.append("avatar", avatarFile);

            let res;
            if (profileIdToEdit) {
                console.log("profileIdToEdit", profileIdToEdit);
                res = await axios.put(`/api/player-profile/${profileIdToEdit}`, fd);
                onSaved(profileIdToEdit);
            } else {
                res = await axios.post("/api/player-profile", fd);
                onSaved(res.data.profile.id);
            }

            if (res.data.success) {
                alert(profileIdToEdit ? "Profile updated!" : "Profile created!");
            }
        } catch (err) {
            console.error(err);
            alert("Error saving profile");
        } finally {
            setLoading(false);
        }
    };

    const avatarPreview = getPreview(avatarFile, initialAvatar);

    return (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-6">
            {/* Upload via Excel */}
            <div className="bg-blue-900/10 border border-blue-800/30 p-4 rounded-lg flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-blue-400">Autofill with Excel</h3>
                    <p className="text-xs text-gray-500 mt-1">Upload a spreadsheet containing player data to automatically fill this form.</p>
                </div>
                <div>
                    <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleExcelUpload}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded transition"
                    >
                        Upload Excel
                    </button>
                </div>
            </div>

            {/* Basic Info */}
            <SectionTitle title="Basic Info" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="Player Name *"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Virat Kohli"
                />
                <Input
                    label="Team Code *"
                    name="team"
                    value={form.team}
                    onChange={handleChange}
                    placeholder="e.g. RCB"
                />
                <Input
                    label="Type / Style"
                    name="battingStyle"
                    value={form.battingStyle}
                    onChange={handleChange}
                    placeholder="e.g. Right-handed"
                />
                <Input
                    label="Type / Style"
                    name="bowlingStyle"
                    value={form.bowlingStyle}
                    onChange={handleChange}
                    placeholder="e.g. Right-arm fast-medium"
                />
            </div>

            <Divider />

            {/* About */}
            <SectionTitle title="About" />
            <Textarea
                label="About the Player"
                name="about"
                value={form.about}
                onChange={handleChange}
                placeholder="Write a brief description of the player..."
            />

            <Divider />

            {/* Avatar */}
            <SectionTitle title="Avatar / Logo" />
            <div className="flex items-start gap-4">
                <div className="flex-1">
                    <FileInput label="Upload Avatar / Club Logo" onChange={setAvatarFile} />
                </div>
                {avatarPreview && (
                    <img
                        src={avatarPreview}
                        alt="avatar preview"
                        className="w-24 h-24 object-cover rounded-full border-2 border-[#30363d] mt-5 shrink-0"
                    />
                )}
            </div>

            <Divider />

            {/* Stats */}
            <SectionTitle title="Stats" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                    label="Runs"
                    name="statsRuns"
                    value={form.statsRuns}
                    onChange={handleChange}
                    placeholder="e.g. 6211"
                />
                <Input
                    label="Strike Rate"
                    name="statsSr"
                    value={form.statsSr}
                    onChange={handleChange}
                    placeholder="e.g. 130.4"
                />
                <Input
                    label="Average"
                    name="statsAvg"
                    value={form.statsAvg}
                    onChange={handleChange}
                    placeholder="e.g. 31.3"
                />
            </div>

            <Divider />

            {/* Overview */}
            <SectionTitle title="Overview" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    label="IPL Debut"
                    name="iplDebut"
                    value={form.iplDebut}
                    onChange={handleChange}
                    placeholder="e.g. 2008"
                />
                <Input
                    label="Specialization"
                    name="specialization"
                    value={form.specialization}
                    onChange={handleChange}
                    placeholder="e.g. Right-arm fast-medium"
                />
                <Input
                    label="Date of Birth"
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
                    placeholder="e.g. 1998-05-20"
                />
                <Input
                    label="Matches"
                    name="matches"
                    value={form.matches}
                    onChange={handleChange}
                    placeholder="e.g. 150"
                />
            </div>

            <FormActions
                onSave={handleSubmit}
                onCancel={onCancel}
                loading={loading}
                isEdit={!!profileIdToEdit}
                saveLabel="Save & Continue →"
            />
        </div>
    );
}