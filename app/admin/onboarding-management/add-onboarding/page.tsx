// app/admin/onboarding-management/add-onboarding/page.tsx
'use client';

import { useEffect, useState } from "react";
import axios from "axios";

type ConfigType = "sports" | "followEntities" | "engagement";

const TABS: { key: ConfigType; label: string }[] = [
  { key: "sports", label: "Sports (Step 1)" },
  { key: "followEntities", label: "Follow Entities (Step 2)" },
  { key: "engagement", label: "Engagement (Step 3)" },
];

// IMPORTANT: this must point at the config CRUD API, not the user-facing
// onboarding-submission API. If your route file currently lives at
// app/api/roar/onboarding/route.ts, move/rename it to
// app/api/roar/onboarding-config/route.ts so it doesn't collide with the
// real user onboarding endpoint.
const CONFIG_API = "/api/roar/onboarding-config";

const inputClass =
  "w-full border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-400";
const labelClass = "block text-xs font-medium text-gray-400 mb-1";

export default function OnboardingConfigAdmin() {
  const [tab, setTab] = useState<ConfigType>("sports");
  const [items, setItems] = useState<any[]>([]);
  const [sportsList, setSportsList] = useState<any[]>([]); // for followEntities dropdown
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null); // null = not editing, {} = new

  const load = async (type: ConfigType) => {
    setLoading(true);
    const res = await axios.get(`${CONFIG_API}?type=${type}&all=true`);
    setItems(res.data.items ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load(tab);
    if (tab === "followEntities" && sportsList.length === 0) {
      axios
        .get(`${CONFIG_API}?type=sports&all=true`)
        .then((r) => setSportsList(r.data.items ?? []));
    }
  }, [tab]); // eslint-disable-line

  const save = async () => {
    if (!editing) return;
    if (editing.id) {
      await axios.patch(CONFIG_API, { type: tab, id: editing.id, updates: editing });
    } else {
      await axios.post(CONFIG_API, { type: tab, item: editing });
    }
    setEditing(null);
    load(tab);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await axios.delete(`${CONFIG_API}?type=${tab}&id=${id}`);
    load(tab);
  };

  const toggleActive = async (item: any) => {
    await axios.patch(CONFIG_API, {
      type: tab,
      id: item.id,
      updates: { active: !item.active },
    });
    load(tab);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 text-gray-100 min-h-screen bg-gray-950">
      <h1 className="text-2xl font-bold mb-4 text-gray-50">ROAR Onboarding Config</h1>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setEditing(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tab === t.key
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-gray-900 text-gray-300 border-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setEditing({ label: "", active: true, order: items.length })}
        className="mb-4 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
      >
        + Add item
      </button>

      {editing && (
        <div className="border border-gray-700 rounded-xl p-4 mb-6 bg-gray-900 space-y-3 shadow-lg">
          <div>
            <label className={labelClass}>Label</label>
            <input
              className={inputClass}
              placeholder="Label"
              value={editing.label || ""}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
            />
          </div>

          {tab === "sports" && (
            <>
              <div>
                <label className={labelClass}>Tagline</label>
                <input
                  className={inputClass}
                  placeholder="Tagline"
                  value={editing.tagline || ""}
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Image path</label>
                <input
                  className={inputClass}
                  placeholder="/images/cricketball.png"
                  value={editing.image || ""}
                  onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                />
              </div>
            </>
          )}

          {tab === "followEntities" && (
            <>
              <div>
                <label className={labelClass}>Short badge text</label>
                <input
                  className={inputClass}
                  placeholder="e.g. IN, MI, RC"
                  value={editing.icon || ""}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <input
                  className={inputClass}
                  placeholder="e.g. CRICKET — INDIA & IPL"
                  value={editing.category || ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Sport</label>
                <select
                  className={inputClass}
                  value={editing.sportId || ""}
                  onChange={(e) => setEditing({ ...editing, sportId: e.target.value })}
                >
                  <option value="">Select sport…</option>
                  {sportsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {tab === "engagement" && (
            <>
              <div>
                <label className={labelClass}>Subtitle</label>
                <input
                  className={inputClass}
                  placeholder="Subtitle"
                  value={editing.subtitle || ""}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Icon (emoji)</label>
                <input
                  className={inputClass}
                  placeholder="🎯"
                  value={editing.icon || ""}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>Order</label>
            <input
              type="number"
              className={inputClass}
              placeholder="Order"
              value={editing.order ?? 0}
              onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border border-gray-700 rounded-lg px-4 py-3 bg-gray-900"
            >
              <div>
                <p className="font-medium text-gray-100">
                  {item.label}{" "}
                  {!item.active && <span className="text-xs text-red-400">(inactive)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {tab === "followEntities"
                    ? `${item.category} · sport: ${item.sportId}`
                    : item.tagline || item.subtitle}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(item)}
                  className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-200 border border-gray-600"
                >
                  {item.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => setEditing(item)}
                  className="text-xs px-3 py-1.5 rounded bg-blue-900 text-blue-200 border border-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs px-3 py-1.5 rounded bg-red-900 text-red-200 border border-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-500">No items yet.</p>}
        </div>
      )}
    </div>
  );
}