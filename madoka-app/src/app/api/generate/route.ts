import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  name?: unknown;
  request?: unknown;
};

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const userRequest =
    typeof body.request === "string" ? body.request.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey });

  const prompt = `あなたは料理の下書きレシピを提案するアシスタントです。
以下の料理について、家庭で作ることを前提としたレシピを生成してください。

料理名: ${name}
${userRequest ? `追加の要望: ${userRequest}\n` : ""}
出力は以下の JSON 形式のみで回答してください。前後に説明文や \`\`\`json マーカーは含めないでください。

{
  "ingredients": ["材料1 分量", "材料2 分量", ...],
  "steps": ["手順1", "手順2", ...],
  "note": "調理のポイントやコツ（短めに）"
}

制約:
- ingredients は 5〜15 要素
- steps は 3〜10 要素、1 ステップ 1 操作
- 分量は 2 人前を目安に
- note は 200 文字以内`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[api/generate] no JSON in response:", text);
      return NextResponse.json(
        { error: "AI レスポンスから JSON を抽出できませんでした" },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[api/generate] JSON parse failed:", e, jsonMatch[0]);
      return NextResponse.json(
        { error: "AI レスポンスの JSON パースに失敗しました" },
        { status: 502 },
      );
    }

    const obj = parsed as Record<string, unknown>;
    const ingredients = Array.isArray(obj.ingredients)
      ? obj.ingredients.filter((x): x is string => typeof x === "string")
      : [];
    const steps = Array.isArray(obj.steps)
      ? obj.steps.filter((x): x is string => typeof x === "string")
      : [];
    const note = typeof obj.note === "string" ? obj.note : "";

    return NextResponse.json({ ingredients, steps, note });
  } catch (e) {
    console.error("[api/generate] error:", e);
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic API 認証エラー（API キーを確認してください）" },
        { status: 500 },
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "レート制限に到達しました。少し待って再試行してください" },
        { status: 429 },
      );
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API エラー: ${e.message}` },
        { status: e.status ?? 500 },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { error: `生成に失敗しました: ${msg}` },
      { status: 500 },
    );
  }
}
