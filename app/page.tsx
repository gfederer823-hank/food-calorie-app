"use client";

import React, { useEffect, useMemo, useState } from "react";

type FoodResult = {
  food: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type LogItem = FoodResult & {
  id: string;
  ts: number;
  imageDataUrl?: string; // optional preview
};

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `foodlog:${yyyy}-${mm}-${dd}`;
}

function safeParseJSON(text: string): FoodResult | null {
  // AI 可能回傳含有多餘文字，這裡盡量把 JSON 抽出來
  try {
    const trimmed = text.trim();

    // 1) 直接就是 JSON
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return JSON.parse(trimmed);
    }

    // 2) 可能包在 json ... 

    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch?.[1]) {
      const inside = codeBlockMatch[1].trim();
      if (inside.startsWith("{") && inside.endsWith("}")) return JSON.parse(inside);
    }

    // 3) 從文字中找第一個 { 到最後一個 }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const candidate = trimmed.slice(first, last + 1);
      return JSON.parse(candidate);
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeResult(r: any): FoodResult | null {
  if (!r || typeof r !== "object") return null;

  const food = String(r.food ?? "").trim();
  const calories = Number(r.calories);
  const protein_g = Number(r.protein_g);
  const carbs_g = Number(r.carbs_g);
  const fat_g = Number(r.fat_g);

  if (!food) return null;
  if (![calories, protein_g, carbs_g, fat_g].every((n) => Number.isFinite(n))) return null;

  return { food, calories, protein_g, carbs_g, fat_g };
}

export default function Page() {
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [rawAI, setRawAI] = useState<string>("");
  const [parsed, setParsed] = useState<FoodResult | null>(null);
  const [error, setError] = useState<string>("");

  const [logs, setLogs] = useState<LogItem[]>([]);

  // load today's logs
  useEffect(() => {
    const key = todayKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setLogs(arr);
      } catch {}
    }
  }, []);

  // persist logs
  useEffect(() => {
    localStorage.setItem(todayKey(), JSON.stringify(logs));
  }, [logs]);

  const totals = useMemo(() => {
    return logs.reduce(
      (acc, it) => {
        acc.calories += it.calories;
        acc.protein_g += it.protein_g;
        acc.carbs_g += it.carbs_g;
        acc.fat_g += it.fat_g;
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );
  }, [logs]);

  const macroCalories = useMemo(() => {
    // 宏量熱量估算：P*4 + C*4 + F*9
    const p = totals.protein_g * 4;
    const c = totals.carbs_g * 4;
    const f = totals.fat_g * 9;
    const sum = p + c + f;
    return { p, c, f, sum };
  }, [totals]);

  const macroRatio = useMemo(() => {
    const { p, c, f, sum } = macroCalories;
    if (sum <= 0) return { pPct: 0, cPct: 0, fPct: 0 };
    return {
      pPct: Math.round((p / sum) * 100),
      cPct: Math.round((c / sum) * 100),
      fPct: Math.round((f / sum) * 100),
    };
  }, [macroCalories]);

  function onPickFile(file: File | null) {
    setError("");
    setRawAI("");
    setParsed(null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setImageDataUrl(result);
    };
    reader.readAsDataURL(file); // data:image/...;base64,...
  }

  async function analyze() {
    setError("");
    setRawAI("");
    setParsed(null);

    if (!imageDataUrl) {
      setError("請先拍照或選擇一張食物照片");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageDataUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "API 失敗");
        return;
      }

      const text = String(data?.result ?? "");
      setRawAI(text);

      const j = safeParseJSON(text);
      const norm = normalizeResult(j);
      if (!norm) {
        setError("AI 回傳格式不符合預期（不是有效 JSON）。你可以把 Raw 內容貼給我，我幫你調 prompt。");
        return;
      }

      setParsed(norm);
    } catch (e: any) {
      setError("呼叫 AI 失敗（可能網路或伺服器問題）");
    } finally {
      setBusy(false);
    }
  }

  function addToLog() {
    if (!parsed) return;
    const item: LogItem = {
      ...parsed,
      id: crypto.randomUUID(),
      ts: Date.now(),
      imageDataUrl,
    };
    setLogs((prev) => [item, ...prev]);

    // 清掉本次結果，方便下一餐
    setParsed(null);
    setRawAI("");
    setImageDataUrl("");
  }

  function removeItem(id: string) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  function clearToday() {
    if (!confirm("確定要清空今天所有記錄嗎？")) return;
    setLogs([]);
    localStorage.removeItem(todayKey());
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>食物熱量紀錄（AI 拍照版）</h1>

      {/* Capture */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-block" }}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={analyze}
            disabled={busy || !imageDataUrl}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: busy || !imageDataUrl ? "#9ca3af" : "#111827",
              color: "white",
              cursor: busy || !imageDataUrl ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "AI 分析中..." : "AI 分析"}
          </button>

          <button
            onClick={addToLog}
            disabled={!parsed}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #10b981",
              background: parsed ? "#10b981" : "#d1fae5",
              color: parsed ? "white" : "#065f46",
              cursor: parsed ? "pointer" : "not-allowed",
            }}
          >
            加入今日記錄
          </button>

          <button
            onClick={clearToday}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "white",
              color: "#ef4444",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            清空今天
          </button>
        </div>

        {imageDataUrl ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>照片預覽：</div>
            <img src={imageDataUrl} alt="preview" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }} />
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b" }}>
            {error}
          </div>
        ) : null}

        {parsed ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>AI 分析結果</div>
            <div>🍽️ 食物：{parsed.food}</div>
            <div>🔥 熱量：{parsed.calories} kcal</div>
            <div>🥩 蛋白質：{parsed.protein_g} g</div>
            <div>🍚 碳水：{parsed.carbs_g} g</div>
            <div>🧈 脂肪：{parsed.fat_g} g</div>
          </div>
        ) : null}

        {rawAI && !parsed ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer" }}>查看 Raw AI 回傳（除錯用）</summary>
            <pre style={{ whiteSpace: "pre-wrap", background: "#111827", color: "white", padding: 12, borderRadius: 12 }}>
              {rawAI}
            </pre>
          </details>
        ) : null}
      </section>

      {/* Totals */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>今日總計</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, minWidth: 180 }}>
            <div style={{ color: "#6b7280", fontSize: 12 }}>熱量</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(totals.calories)} kcal</div>
          </div>

          <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, minWidth: 180 }}>
            <div style={{ color: "#6b7280", fontSize: 12 }}>蛋白質</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(totals.protein_g)} g</div>
          </div>

          <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, minWidth: 180 }}>
            <div style={{ color: "#6b7280", fontSize: 12 }}>碳水</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(totals.carbs_g)} g</div>
          </div>

          <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, minWidth: 180 }}>
            <div style={{ color: "#6b7280", fontSize: 12 }}>脂肪</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(totals.fat_g)} g</div>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#374151" }}>
          宏量比例（用 P*4 + C*4 + F*9 估算）：
          <b> 蛋白 {macroRatio.pPct}%</b> / <b>碳水 {macroRatio.cPct}%</b> / <b>脂肪 {macroRatio.fPct}%</b>
        </div>
      </section>

      {/* Logs */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>今日記錄（最新在上）</h2>

        {logs.length === 0 ? (
          <div style={{ color: "#6b7280" }}>今天還沒有記錄，先拍一張食物照片試試看。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {logs.map((it) => (
              <div key={it.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    🍽️ {it.food} <span style={{ color: "#6b7280", fontWeight: 500, fontSize: 12 }}>
                      {new Date(it.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    style={{ border: "1px solid #ef4444", background: "white", color: "#ef4444", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                  >
                    刪除
                  </button>
                </div>

                <div style={{ marginTop: 6 }}>
                  🔥 {it.calories} kcal　|　🥩 {it.protein_g}g　🍚 {it.carbs_g}g　🧈 {it.fat_g}g
                </div>

                {it.imageDataUrl ? (
                  <img
                    src={it.imageDataUrl}
                    alt="log"
                    style={{ marginTop: 8, maxWidth: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}