require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 4000;
const SERVICE_KEY = process.env.PUBLIC_DATA_SERVICE_KEY;
const INGREDIENT_API_URL = process.env.COSMETIC_INGREDIENT_API_URL;
const RESTRICTED_API_URL = process.env.COSMETIC_RESTRICTED_API_URL;
const {
  enrichIngredientWithPublicData,
} = require("./services/publicDataService");
const {
  generateIngredientSummary,
} = require("./services/openAiAnalysisService");
const {
  generateCosmeticAiAnalysis,
} = require("./services/openAiAnalysisService");
const { performClovaOCR } = require("./services/clovaOcrService");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const { calculatePersonalRiskScore } = require("./services/riskCalculator");

console.log("DEBUG: PUBLIC_DATA_SERVICE_KEY present:", !!SERVICE_KEY);
console.log(
  "DEBUG: PUBLIC_DATA_SERVICE_KEY length:",
  SERVICE_KEY ? SERVICE_KEY.length : 0,
);

app.use(
  cors({
    origin: "*", // 모든 출처 허용 (보안이 필요하다면 ['http://localhost:8081'] 등 명시)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
app.use(express.json());

let ingredientCache = [];
let restrictedCache = [];
let lastSyncTime = null;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[()［］\[\]{}]/g, "")
    .trim();
}

function serverNormalize(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-z가-힣\s]+/gi, " ")
    .toLowerCase()
    .trim();
}

function serverTokensOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]+/gi, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getItemsFromPublicDataResponse(responseData) {
  const body = responseData?.response?.body || responseData?.body;
  const items = body?.items?.item || body?.items;

  if (!items) return [];

  if (Array.isArray(items)) return items;

  return [items];
}

function normalizeIngredientItem(item) {
  return {
    id: item?.RNUM || item?.rnum || item?.SEQ || item?.seq || null,

    koreanName:
      item?.INGR_KOR_NAME ||
      item?.STDR_NM ||
      item?.ingrNm ||
      item?.stdrNm ||
      item?.standardName ||
      "",

    englishName:
      item?.INGR_ENG_NAME ||
      item?.INGR_ENG_NM ||
      item?.engNm ||
      item?.ENG_NM ||
      item?.englishName ||
      "",

    casNo: item?.CAS_NO || item?.casNo || "",

    originDefinition:
      item?.ORIGIN_MAJOR_KOR_NAME ||
      item?.ORIG_NM ||
      item?.originDefinition ||
      item?.DFNT ||
      item?.dfnt ||
      item?.ORIGIN_CN ||
      item?.originCn ||
      "",

    synonyms:
      item?.INGR_SYNONYM ||
      item?.ALTRV_NM ||
      item?.altrvNm ||
      item?.SYNONYM ||
      item?.synonym ||
      item?.ETC_NM ||
      item?.etcNm ||
      "",

    rawName:
      item?.rawName ||
      item?.RAW_NAME ||
      item?.raw_name ||
      item?.rawNm ||
      item?.INGR_KOR_NAME ||
      item?.INGR_ENG_NAME ||
      "",

    name:
      item?.name ||
      item?.NAME ||
      item?.ingredientName ||
      item?.koreanName ||
      item?.standardName ||
      "",

    raw: item,
  };
}

function normalizeRestrictedItem(item) {
  return {
    id: item?.RNUM || item?.rnum || item?.SEQ || item?.seq || null,

    type:
      item?.REGULATE_TYPE ||
      item?.TYPE ||
      item?.type ||
      item?.SE_CD ||
      item?.seCd ||
      "",

    koreanName:
      item?.INGR_STD_NAME ||
      item?.INGR_NM ||
      item?.ingrNm ||
      item?.STDR_NM ||
      item?.stdrNm ||
      item?.standardName ||
      "",

    englishName:
      item?.INGR_ENG_NAME ||
      item?.INGR_ENG_NM ||
      item?.engNm ||
      item?.ENG_NM ||
      "",

    casNo: item?.CAS_NO || item?.casNo || "",

    synonyms:
      item?.INGR_SYNONYM ||
      item?.ALTRV_NM ||
      item?.altrvNm ||
      item?.SYNONYM ||
      item?.synonym ||
      "",

    restrictedCountry:
      item?.COUNTRY_NAME ||
      item?.LMT_CNTY ||
      item?.lmtCnty ||
      item?.BAN_CNTY ||
      item?.banCnty ||
      "",

    noticeIngredientName:
      item?.NOTICE_INGR_NAME || item?.NTFC_INGR_NM || item?.ntfcIngrNm || "",

    condition:
      item?.LIMIT_COND ||
      item?.LMT_CN ||
      item?.lmtCn ||
      item?.LIMIT_CN ||
      item?.limitCn ||
      item?.condition ||
      "",

    raw: item,
  };
}

async function fetchPublicDataPage(apiUrl, pageNo = 1, numOfRows = 100) {
  if (!SERVICE_KEY) {
    throw new Error("PUBLIC_DATA_SERVICE_KEY가 .env에 없습니다.");
  }

  const params = {
    serviceKey: SERVICE_KEY,
    pageNo,
    numOfRows,
    type: "json",
  };

  console.log("CALL PUBLIC API:", apiUrl, params);

  try {
    const response = await axios.get(apiUrl, { params, timeout: 15000 });
    console.log("PUBLIC API HTTP:", response.status);
    return response.data;
  } catch (err) {
    console.log("PUBLIC API ERROR:", err.message);
    if (err.response) {
      try {
        console.log("PUBLIC API ERROR STATUS:", err.response.status);
        console.log(
          "PUBLIC API ERROR DATA:",
          JSON.stringify(err.response.data).slice(0, 2000),
        );
      } catch (e) {
        console.log(
          "PUBLIC API ERROR (unable to stringify response):",
          e.message,
        );
      }
    }
    throw err;
  }
}

async function fetchAllPages(apiUrl, normalizer, maxPages = 5) {
  const allItems = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const data = await fetchPublicDataPage(apiUrl, pageNo, 100);
    const items = getItemsFromPublicDataResponse(data);

    if (items.length === 0) break;

    const normalizedItems = items.map(normalizer);
    allItems.push(...normalizedItems);

    if (items.length < 100) break;
  }

  return allItems;
}

async function syncPublicData() {
  const ingredients = await fetchAllPages(
    INGREDIENT_API_URL,
    normalizeIngredientItem,
    10,
  );

  ingredientCache = ingredients;

  if (RESTRICTED_API_URL) {
    try {
      restrictedCache = await fetchAllPages(
        RESTRICTED_API_URL,
        normalizeRestrictedItem,
        5,
      );
    } catch (error) {
      console.warn("사용제한 원료정보 동기화 실패:", error.message);
      restrictedCache = [];
    }
  }

  lastSyncTime = new Date().toISOString();

  console.log("INGREDIENT SAMPLE COUNT:", ingredientCache.length);
  console.log("INGREDIENT SAMPLE 1:", ingredientCache[0]);
  console.log("INGREDIENT SAMPLE KEYS:", Object.keys(ingredientCache[0] || {}));
  console.log(
    "INGREDIENT NAME CANDIDATES:",
    ingredientCache.slice(0, 5).map((item) => ({
      name: item.name,
      koreanName: item.koreanName,
      englishName: item.englishName,
      ingredientName: item.ingredientName,
      rawName: item.rawName,
      INGR_KOR_NM: item.INGR_KOR_NM,
      INGR_ENG_NM: item.INGR_ENG_NM,
      ITEM_NAME: item.ITEM_NAME,
    })),
  );

  return {
    ingredientCount: ingredientCache.length,
    restrictedCount: restrictedCache.length,
    lastSyncTime,
  };
}

function buildSearchText(item) {
  const values = [];

  function flatten(value) {
    if (value == null) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      values.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(flatten);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(flatten);
    }
  }

  flatten(item);

  return values.map((value) => String(value || "").toLowerCase()).join(" ");
}

function searchIngredientCache(keyword) {
  const rawKeyword = String(keyword || "").trim();
  const normalizedKeyword = normalizeText(rawKeyword);

  if (normalizedKeyword.includes("정제수") || rawKeyword.includes("정제수")) {
    console.log(
      "DEBUG search text samples for 정제수:",
      ingredientCache.slice(0, 5).map((item) => ({
        raw: item,
        searchText: buildSearchText(item),
      })),
    );
  }

  return ingredientCache.filter((item) => {
    const searchText = buildSearchText(item);
    const normalizedText = normalizeText(searchText);

    return normalizedText.includes(normalizedKeyword);
  });
}

function findRestrictedInfo(ingredient) {
  const targetNames = [
    ingredient.koreanName,
    ingredient.englishName,
    ingredient.casNo,
  ]
    .filter(Boolean)
    .map(normalizeText);

  return restrictedCache.find((restricted) => {
    const restrictedValues = [
      restricted.koreanName,
      restricted.englishName,
      restricted.casNo,
      restricted.synonyms,
    ]
      .filter(Boolean)
      .map(normalizeText);

    return targetNames.some((target) =>
      restrictedValues.some(
        (value) => value && target && value.includes(target),
      ),
    );
  });
}

function splitIngredientsText(text) {
  return String(text || "")
    .split(/,|\n|\/|\(|\)|:|·|ㆍ|;|•|•|•|·|–|-/)
    .map((value) =>
      String(value || "")
        .replace(/[%€$£]|mg|ml|g|\d+\s*ml|\d+\s*mg/gi, "")
        .replace(/["'`·••]/g, "")
        .trim(),
    )
    .map((v) => v.replace(/^[^0-9a-zA-Z가-힣]+|[^0-9a-zA-Z가-힣]+$/g, ""))
    .map((v) => v.trim())
    .filter(Boolean);
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function cleanPublicDataText(text) {
  return String(text || "")
    .replace(/\r\n|\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyOriginDefinition(text) {
  let origin = cleanPublicDataText(text);

  origin = origin.replace(
    /이\s*원료는\s*(?:주로\s*)?다음의\s*구조를\s*갖는/gi,
    "이 원료는",
  );
  origin = origin.replace(/다음의\s*구조를\s*갖는/gi, "");
  origin = origin.replace(/\s+/g, " ").trim();

  if (/^(?:이\s*원료는\s*)?.*유기화합물이다\.?$/i.test(origin)) {
    return "공공데이터에서는 해당 원료를 유기화합물로 분류하고 있습니다.";
  }

  return origin;
}

function isGenericOriginDefinition(text) {
  const normalized = cleanPublicDataText(text).toLowerCase();
  return (
    !normalized ||
    /다음의\s*구조를\s*갖는|유기화합물이다|구조를\s*갖는/.test(normalized)
  );
}

function buildPublicDataSummary(item) {
  const originDefinition = simplifyOriginDefinition(item.originDefinition);
  const synonyms = cleanPublicDataText(item.synonyms);
  const parts = [];

  if (originDefinition && !isGenericOriginDefinition(item.originDefinition)) {
    parts.push(originDefinition);
  }
  if (synonyms) {
    parts.push(`동의어: ${synonyms}`);
  }

  if (parts.length === 0) {
    const englishName = cleanPublicDataText(item.englishName);
    const casNo = cleanPublicDataText(item.casNo);

    if (englishName || casNo) {
      const englishText = englishName
        ? `${englishName}으로 알려진 성분입니다.`
        : "";
      const casText = casNo ? `CAS No: ${casNo}.` : "";

      return [englishText, casText].filter(Boolean).join(" ").trim();
    }

    return "공공데이터 원본에는 해당 성분에 대한 구체적인 설명이 없습니다.";
  }

  return parts.join(" / ");
}

function isWeakSummary(summary) {
  const normalized = String(summary || "")
    .trim()
    .toLowerCase();
  return (
    !normalized ||
    normalized.includes(
      "공공데이터 원본에는 해당 성분에 대한 구체적인 설명이 없습니다.",
    ) ||
    normalized.includes(
      "공공데이터 원본 정보가 있으나 사용자용 요약이 아직 없습니다.",
    ) ||
    normalized.includes(
      "공공데이터에서는 해당 원료를 유기화합물로 분류하고 있습니다.",
    ) ||
    /구조를 갖는|유기화합물이다/.test(normalized)
  );
}

async function maybeEnhanceSummary(item, currentSummary) {
  if (!isWeakSummary(currentSummary)) {
    return currentSummary;
  }

  const lookupName =
    item.koreanName || item.ingredientName || item.synonyms || item.englishName;

  if (!lookupName) {
    return currentSummary;
  }

  const enriched = await enrichIngredientWithPublicData(lookupName);

  if (enriched.hasPublicData && enriched.userSummary) {
    const enhancedDefinition = String(
      enriched.userSummary.definition || "",
    ).trim();
    const simpleSummary = String(
      enriched.userSummary.simpleSummary || "",
    ).trim();

    if (enhancedDefinition && !isWeakSummary(enhancedDefinition)) {
      return enhancedDefinition;
    }

    if (
      simpleSummary &&
      !simpleSummary.includes("직접 확인된 정보가 없습니다")
    ) {
      return simpleSummary;
    }
  }

  return await generateIngredientSummary({
    ingredientName: lookupName,
    originDefinition: item.originDefinition,
    synonyms: item.synonyms,
    englishName: item.englishName,
    casNo: item.casNo,
    fallbackSummary: currentSummary,
  });
}

function findMatchedIngredient(name) {
  const normalizedName = serverNormalize(name);

  if (!normalizedName) return null;

  const inputTokens = serverTokensOf(name);

  for (const item of ingredientCache) {
    const candidates = [
      item.koreanName,
      item.englishName,
      item.synonyms,
      item.name,
      item.rawName,
      item.ingredientName,
    ]
      .filter(Boolean)
      .map((s) => String(s));

    const normCandidates = candidates.map(serverNormalize);

    // exact or contains
    if (normCandidates.includes(normalizedName)) return item;
    if (
      normCandidates.some(
        (n) => n && (n.includes(normalizedName) || normalizedName.includes(n)),
      )
    )
      return item;

    // token overlap scoring
    for (const n of normCandidates) {
      if (!n) continue;
      const candTokens = serverTokensOf(n);
      if (candTokens.length === 0 || inputTokens.length === 0) continue;
      const intersection = candTokens.filter((t) => inputTokens.includes(t));
      const score =
        intersection.length / Math.max(candTokens.length, inputTokens.length);
      if (score >= 0.5 || intersection.length >= 2) return item;
      if (
        intersection.length >= 1 &&
        (candTokens.some((t) => t.length >= 4) ||
          inputTokens.some((t) => t.length >= 4))
      )
        return item;
    }

    // aliases split and fuzzy check
    const synonymsRaw = String(item.synonyms || item.aliases || "");
    const aliases = synonymsRaw
      .split(/,|\/|;|\||\(|\)|\s{2,}/)
      .map((s) => serverNormalize(s))
      .filter(Boolean);

    for (const a of aliases) {
      if (!a) continue;
      if (
        a === normalizedName ||
        a.includes(normalizedName) ||
        normalizedName.includes(a)
      )
        return item;
    }

    // fuzzy fallback (small edit distance relative to length)
    const threshold = Math.max(
      1,
      Math.floor(Math.min(3, normalizedName.length * 0.2)),
    );
    try {
      for (const n of normCandidates) {
        if (!n) continue;
        if (levenshtein(n, normalizedName) <= threshold) return item;
      }
      for (const a of aliases) {
        if (levenshtein(a, normalizedName) <= threshold) return item;
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

app.get("/", (req, res) => {
  res.json({
    message: "SafeLabel API server is running",
    dataSource: "식품의약품안전처 공공데이터 API",
    ingredientCount: ingredientCache.length,
    restrictedCount: restrictedCache.length,
    lastSyncTime,
  });
});

app.post("/api/public-data/sync", async (req, res) => {
  try {
    const result = await syncPublicData();

    res.json({
      message: "공공데이터 동기화 완료",
      ...result,
    });
  } catch (error) {
    console.error("공공데이터 동기화 오류:", error.message);

    res.status(500).json({
      message: "공공데이터 동기화 실패",
      error: error.message,
    });
  }
});

app.get("/api/ingredients/search", async (req, res) => {
  try {
    const { name } = req.query;
    const keyword = String(name || "").trim();

    console.log("Ingredient search request:", keyword);

    if (!keyword) {
      return res.status(400).json({
        message: "검색어를 입력해주세요.",
        data: [],
      });
    }

    if (ingredientCache.length === 0) {
      await syncPublicData();
    }

    console.log("Ingredient search source count:", ingredientCache.length);

    const results = searchIngredientCache(keyword).slice(0, 30);

    console.log("Ingredient search result count:", results.length);

    const mappedResults = await Promise.all(
      results.map(async (item, index) => {
        const restrictedInfo = findRestrictedInfo(item);
        const initialSummary = buildPublicDataSummary(item);
        const summary =
          index < 3
            ? await maybeEnhanceSummary(item, initialSummary)
            : initialSummary;

        return {
          ...item,
          summary,
          hasPublicData: true,
          isRestricted: Boolean(restrictedInfo),
          restrictedInfo: restrictedInfo || null,
        };
      }),
    );

    res.json({
      keyword,
      count: mappedResults.length,
      source: "식품의약품안전처_화장품 원료성분정보",
      data: mappedResults,
    });
  } catch (error) {
    console.error("성분 검색 오류:", error.message);

    res.status(500).json({
      message: "성분 검색 실패",
      error: error.message,
      data: [],
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { ingredientsText } = req.body;

    if (!ingredientsText || !String(ingredientsText).trim()) {
      return res.status(400).json({
        message: "분석할 성분 텍스트가 없습니다.",
      });
    }

    if (ingredientCache.length === 0) {
      await syncPublicData();
    }

    const detectedNames = splitIngredientsText(ingredientsText);

    const matchedIngredients = [];
    const unmatchedIngredients = [];

    detectedNames.forEach((name) => {
      const matched = findMatchedIngredient(name);

      if (matched) {
        const restrictedInfo = findRestrictedInfo(matched);

        matchedIngredients.push({
          ...matched,
          isRestricted: Boolean(restrictedInfo),
          restrictedInfo: restrictedInfo || null,
        });
      } else {
        unmatchedIngredients.push(name);
      }
    });

    const cautionIngredients = matchedIngredients.filter(
      (item) => item.isRestricted,
    );

    const totalCount = detectedNames.length;
    const matchedCount = matchedIngredients.length;
    const unmatchedCount = unmatchedIngredients.length;
    const matchRate =
      totalCount === 0 ? 0 : Math.round((matchedCount / totalCount) * 100);

    let confidence = "낮음";

    if (matchRate >= 80) {
      confidence = "높음";
    } else if (matchRate >= 50) {
      confidence = "보통";
    }

    res.json({
      source: [
        "식품의약품안전처_화장품 원료성분정보",
        "식품의약품안전처_화장품 사용제한 원료정보",
      ],
      totalCount,
      matchedCount,
      unmatchedCount,
      matchRate,
      confidence,
      matchedIngredients,
      unmatchedIngredients,
      cautionIngredients,
    });
  } catch (error) {
    console.error("성분 분석 오류:", error.message);

    res.status(500).json({
      message: "성분 분석 실패",
      error: error.message,
    });
  }
});

console.log(`SafeLabel API server configured for port ${PORT}`);

// OCR analyze endpoint: accepts multipart/form-data with `image` and optional profile fields
app.post("/api/ocr/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "이미지 파일이 필요합니다." });
    }

    // Parse optional user profile fields
    let userProfile = {};
    try {
      userProfile = {
        skinType: req.body.skinType || "",
        sensitivity: req.body.sensitivity || "",
        allergies: req.body.allergies ? JSON.parse(req.body.allergies) : [],
        avoidIngredients: req.body.avoidIngredients
          ? JSON.parse(req.body.avoidIngredients)
          : [],
      };
    } catch (e) {
      userProfile = {
        skinType: "",
        sensitivity: "",
        allergies: [],
        avoidIngredients: [],
      };
    }

    // Call CLOVA OCR
    const ocrResponse = await performClovaOCR(
      req.file.buffer,
      req.file.originalname || "upload.jpg",
    );

    // Extract text from common Clova response shapes
    let ocrText = "";
    try {
      if (
        ocrResponse?.images &&
        Array.isArray(ocrResponse.images) &&
        ocrResponse.images[0]?.fields
      ) {
        ocrText = ocrResponse.images[0].fields
          .map((f) => f.inferText || "")
          .join(" ");
      } else if (
        ocrResponse?.outputs &&
        Array.isArray(ocrResponse.outputs) &&
        ocrResponse.outputs[0]?.data?.text
      ) {
        ocrText = String(ocrResponse.outputs[0].data.text || "");
      } else if (typeof ocrResponse === "string") {
        ocrText = ocrResponse;
      } else {
        ocrText = JSON.stringify(ocrResponse || "");
      }
    } catch (e) {
      ocrText = "";
    }

    const detectedNames = splitIngredientsText(ocrText);

    // Helpful debug logs to inspect OCR raw output and tokens
    console.log(
      "OCR RAW TEXT:",
      ocrText
        ? ocrText.length > 1000
          ? ocrText.slice(0, 1000) + "..."
          : ocrText
        : "(empty)",
    );
    console.log("OCR TOKENS:", detectedNames.slice(0, 50));

    const matchedIngredients = [];
    const unmatchedIngredients = [];

    detectedNames.forEach((name) => {
      const matched = findMatchedIngredient(name);

      if (matched) {
        const restrictedInfo = findRestrictedInfo(matched);

        matchedIngredients.push({
          originalName: name,
          standardName: matched.koreanName || matched.standardName || name,
          englishName: matched.englishName || "",
          description: matched.originDefinition || "",
          isMatched: true,
          isRestricted: Boolean(restrictedInfo),
          restrictedReason: restrictedInfo
            ? restrictedInfo.condition || ""
            : "",
          isAllergen: false,
          allergenReason: "",
          riskWeight: matched.riskWeight || 0,
          publicData: null,
        });
      } else {
        unmatchedIngredients.push(name);
      }
    });

    const cautionIngredients = matchedIngredients
      .filter((i) => i.isRestricted)
      .map((i) => i.standardName || i.originalName);

    // Calculate personal risk
    const riskResult = calculatePersonalRiskScore(
      matchedIngredients,
      userProfile,
    );

    // Build simple fallback summary/recommendation
    const fallbackSummary =
      matchedIngredients.length > 0
        ? `다음 성분이 감지되었습니다: ${matchedIngredients.map((i) => i.originalName).join(", ")}`
        : "OCR로 추출된 성분을 찾을 수 없습니다.";

    const fallbackRecommendation =
      "민감 피부이거나 알레르기 이력이 있다면 사용 전 패치 테스트를 권장합니다.";

    // Ask AI for a concise summary/recommendation when possible
    const aiResult = await generateCosmeticAiAnalysis({
      productName: req.body.productName || "",
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      mainIngredients: matchedIngredients.map(
        (i) => i.standardName || i.originalName,
      ),
      cautionIngredients,
      matchedIngredients,
      riskReasons: riskResult.reasons,
      userProfile,
      fallbackSummary,
      fallbackRecommendation,
    });

    res.json({
      productName: req.body.productName || "OCR 분석 결과",
      ocrText,
      totalCount: detectedNames.length,
      matchedCount: matchedIngredients.length,
      unmatchedCount: unmatchedIngredients.length,
      matchRate:
        detectedNames.length === 0
          ? 0
          : Math.round(
              (matchedIngredients.length / detectedNames.length) * 100,
            ),
      confidence:
        detectedNames.length === 0
          ? "낮음"
          : matchedIngredients.length / detectedNames.length >= 0.8
            ? "높음"
            : matchedIngredients.length / detectedNames.length >= 0.5
              ? "보통"
              : "낮음",
      matchedIngredients,
      unmatchedIngredients,
      cautionIngredients,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      riskReasons: riskResult.reasons,
      summary: aiResult.summary || fallbackSummary,
      recommendation: aiResult.recommendation || fallbackRecommendation,
      aiProvider: aiResult.aiProvider || "fallback",
      aiModel: aiResult.aiModel || null,
      type: "single",
    });
  } catch (error) {
    console.error(
      "OCR 분석 오류:",
      error && error.message ? error.message : error,
    );
    res.status(500).json({
      message: "OCR 분석 실패",
      error: error?.message || String(error),
    });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`SafeLabel API server running on http://localhost:${PORT}`);
});

syncPublicData()
  .then((result) => {
    console.log("초기 공공데이터 동기화 완료:", result);
  })
  .catch((error) => {
    console.warn("초기 공공데이터 동기화 실패:", error.message);
  });
