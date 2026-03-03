"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  ts: number;
  name: string;
  calories: number;
  image?: string;
};

const STORAGE_KEY = "food_calorie_entries_v1";

function todayKey(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [image, setImage] = useState<string | undefined>();

  // 讀取保存資料
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {}
  }, []);

  // 自動保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }, [entries]);

  function handleImage(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function addEntry() {
    const cal = Number(calories);
    if (!name.trim()) return alert("請輸入食物名稱");
    if (!Number.isFinite(cal) || cal < 0) return alert("請輸入正確卡路里");

    const newEntry: Entry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      name: name.trim(),
      calories: Math.round(cal),
      image,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setName("");
    setCalories("");
    setImage(undefined);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const today = todayKey(Date.now());
  const todayEntries = useMemo(
    () => entries.filter((e) => todayKey(e.ts) === today),
    [entries, today]
  );

  const total = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.calories, 0),
    [todayEntries]
  );

  return (
    <main style={{ padding: 20, maxWidth: 520, margin: "auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>🍱 食物熱量記錄</h1>
      <h3 style={{ marginTop: 0 }}>今日總熱量：{total} kcal</h3>

      <div style={{ display: "grid", gap: 10 }}>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} />
        {image && <img src={image} style={{ width: "100%", borderRadius: 12, border: "1px solid #eee" }} />}

        <input
          placeholder="食物名稱（例如：雞胸便當）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <input
          placeholder="卡路里（例如：650）"
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <button onClick={addEntry} style={{ width: "100%", padding: 12, borderRadius: 10 }}>
          新增
        </button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      <h3>今天的紀錄（{todayEntries.length}）</h3>

      {todayEntries.length === 0 ? (
        <div style={{ color: "#666" }}>今天還沒有紀錄。</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {todayEntries.map((e) => (
            <div key={e.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <b>{e.name}</b> — {e.calories} kcal
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(e.ts).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button onClick={() => removeEntry(e.id)} style={{ borderRadius: 10 }}>
                  刪除
                </button>
              </div>

              {e.image && <img src={e.image} style={{ width: "100%", marginTop: 10, borderRadius: 12 }} />}
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        ✅ 紀錄已保存到本機。關掉瀏覽器、重開也會在。
      </p>
    </main>
  );
}