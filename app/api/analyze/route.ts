export const runtime = "nodejs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return Response.json({ error: "missing imageUrl" }, { status: 400 });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0,
      text: { format: { type: "json_object" } }, // ✅ 強制輸出有效 JSON
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `你是營養分析助手。請只回傳「有效 JSON」，不要任何多餘文字、不要 markdown、不要 code fence。
JSON 格式固定如下（key 必須存在）：
{
  "food": "食物名稱",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}
注意：calories/protein_g/carbs_g/fat_g 都是 number（不要單位）。`,
            },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
    });

    const raw = response.output_text || "";

    // ✅ 後端先 parse 成物件，前端就不會再遇到「不是 JSON」
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "invalid_json", raw }, { status: 200 });
    }

    return Response.json({ result: parsed, raw });
 } catch (error: any) {
  console.error("analyze error:", error);
  return Response.json(
    { error: error?.message ?? String(error) },
    { status: 500 }
  );
}
}