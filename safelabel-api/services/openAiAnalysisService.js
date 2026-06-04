const axios = require("axios");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";

async function generateCosmeticAiAnalysis({
  productName,
  riskScore,
  riskLevel,
  mainIngredients,
  cautionIngredients,
  matchedIngredients,
  riskReasons,
  userProfile,
  fallbackSummary,
  fallbackRecommendation,
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      summary: fallbackSummary,
      recommendation: fallbackRecommendation,
      aiProvider: "fallback",
      aiModel: "local-fallback",
    };
  }

  try {
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const payload = {
      model,
      instructions: [
        "You are SafeLabel AI, a Korean cosmetic ingredient analysis assistant.",
        "Use the supplied OCR and rule-based risk data as evidence.",
        "Do not invent ingredient facts that are not present in the input.",
        "Write concise Korean for a consumer app.",
        "This is cosmetic safety guidance, not medical diagnosis.",
      ].join(" "),
      input: JSON.stringify(
        {
          productName,
          riskScore,
          riskLevel,
          mainIngredients,
          cautionIngredients,
          matchedIngredients: (matchedIngredients || []).map((item) => ({
            originalName: item.originalName,
            standardName: item.standardName,
            englishName: item.englishName,
            isRestricted: item.isRestricted,
            isAllergen: item.isAllergen,
            restrictedReason: item.restrictedReason,
            allergenReason: item.allergenReason,
            riskWeight: item.riskWeight,
          })),
          riskReasons,
          userProfile,
        },
        null,
        2
      ),
      text: {
        format: {
          type: "json_schema",
          name: "cosmetic_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: {
                type: "string",
                description: "One or two Korean sentences summarizing the risk.",
              },
              recommendation: {
                type: "string",
                description:
                  "One or two Korean sentences with practical usage advice.",
              },
            },
            required: ["summary", "recommendation"],
          },
        },
      },
      max_output_tokens: 500,
    };

    const response = await axios.post(OPENAI_RESPONSES_URL, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    const content = extractResponseText(response.data);
    const parsed = JSON.parse(content);

    return {
      summary: normalizeGeneratedText(parsed.summary, fallbackSummary),
      recommendation: normalizeGeneratedText(
        parsed.recommendation,
        fallbackRecommendation
      ),
      aiProvider: "openai",
      aiModel: model,
    };
  } catch (error) {
    console.error("OpenAI analysis failed:");
    console.error(error.response?.data || error.message);

    return {
      summary: fallbackSummary,
      recommendation: fallbackRecommendation,
      aiProvider: "fallback",
      aiModel: "local-fallback",
    };
  }
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const message = (data?.output || []).find((item) => item.type === "message");
  const textItem = (message?.content || []).find(
    (item) => item.type === "output_text"
  );

  if (typeof textItem?.text === "string") {
    return textItem.text;
  }

  throw new Error("OpenAI response did not include output text.");
}

function normalizeGeneratedText(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

async function generateIngredientSummary({
  ingredientName,
  originDefinition,
  synonyms,
  englishName,
  casNo,
  fallbackSummary,
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackSummary;
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const prompt = [
    "당신은 한국어 화장품 성분 검색 앱의 요약 작성 도우미입니다.",
    "입력된 성분 정보를 기반으로 소비자가 쉽게 이해할 수 있는 한두 문장의 한국어 요약을 만드세요.",
    "입력에 명시된 사실 외에는 추가로 추론하거나 발명하지 마세요.",
    "공공데이터 입력이 불충분하면, 해당 정보를 앱에서 찾을 수 없다고 명확히 알려주세요.",
  ].join(" ");

  const input = JSON.stringify(
    {
      ingredientName,
      originDefinition,
      synonyms,
      englishName,
      casNo,
    },
    null,
    2
  );

  const payload = {
    model,
    instructions: prompt,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "ingredient_summary",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: {
              type: "string",
              description: "One or two Korean sentences explaining the ingredient clearly.",
            },
          },
          required: ["summary"],
        },
      },
    },
    max_output_tokens: 200,
  };

  try {
    const response = await axios.post(OPENAI_RESPONSES_URL, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    const content = extractResponseText(response.data);
    const parsed = JSON.parse(content);

    return normalizeGeneratedText(parsed.summary, fallbackSummary);
  } catch (error) {
    console.error("OpenAI ingredient summary failed:");
    console.error(error.response?.data || error.message);
    return fallbackSummary;
  }
}

module.exports = {
  generateCosmeticAiAnalysis,
  generateIngredientSummary,
};
