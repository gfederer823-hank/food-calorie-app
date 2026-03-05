export const runtime = "nodejs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {

  try {

    const body = await req.json();
    const imageUrl = body.imageUrl;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `請分析圖片中的食物並回傳 JSON，格式如下：
{
food:"食物名稱",
calories:熱量,
protein_g:蛋白質克數,
carbs_g:碳水克數,
fat_g:脂肪克數
}`
            },
            {
              type: "input_image",
              image_url: imageUrl, detail: "auto"
            }
          ]
        }
      ]
    });

    return Response.json({
      result: response.output_text
    });

  } catch (error) {

    return Response.json({
      error: "AI分析失敗"
    });

  }

}