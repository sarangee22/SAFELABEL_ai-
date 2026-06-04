require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const { matchIngredients } = require("./services/ingredientMatcher");
const { calculatePersonalRiskScore } = require("./services/riskCalculator");
const {
  enrichIngredientWithPublicData,
} = require("./services/publicDataService");
const { performClovaOCR } = require("./services/clovaOcrService");

const app = express();
const PORT = 4000;

const PUBLIC_DATA_LOOKUP_LIMIT = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("SafeLabel OCR API is running");
});

app.post("/api/ocr/analyze", upload.single("image"), async (req, res) => {
  try {
    console.log("====================================");
    console.log("OCR 분석 요청 도착");

    if (!req.file) {
      console.log("이미지 파일 없음");

      return res.status(400).json({
        message: "이미지가 없습니다.",
      });
    }

    console.log("이미지 수신 완료");
    console.log("파일명:", req.file.originalname);
    console.log("파일 타입:", req.file.mimetype);
    console.log("파일 크기:", req.file.size);

    console.log("Naver CLOVA OCR API 호출 시작");

    const clovaResult = await performClovaOCR(
      req.file.buffer,
      req.file.originalname || "image.jpg"
    );

    let ocrText = "";
    if (
      clovaResult.images &&
      clovaResult.images[0] &&
      clovaResult.images[0].fields
    ) {
      // CLOVA OCR은 인식된 단어들을 fields 배열에 담아서 반환합니다.
      ocrText = clovaResult.images[0].fields
        .map((field) => field.inferText)
        .join(" ");
    }

    console.log("OCR 원문:");
    console.log(ocrText);

    const ingredientSection = extractIngredientSection(ocrText);

    console.log("추출된 성분 영역:");
    console.log(ingredientSection);

    const userProfile = {
      skinType: req.body.skinType || "",
      sensitivity: req.body.sensitivity || "",
      allergies: safeJsonParse(req.body.allergies, []),
      avoidIngredients: safeJsonParse(req.body.avoidIngredients, []),
    };

    console.log("사용자 프로필:");
    console.log(userProfile);

    const analysisResult = await analyzeCosmeticIngredients(
      ocrText,
      ingredientSection,
      userProfile
    );

    console.log("성분 분석 결과:");
    console.log(analysisResult);
    console.log("====================================");

    return res.json({
      ...analysisResult,
      ocrText,
      ingredientSection,
    });
  } catch (error) {
    console.error("OCR 분석 오류:");
    console.error(error);

    return res.status(500).json({
      message: "OCR 분석 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

async function analyzeCosmeticIngredients(
  ocrText,
  ingredientSection,
  userProfile = {}
) {
  const mainIngredients = extractIngredients(ingredientSection);

  console.log("최종 추출 성분 목록:");
  console.log(mainIngredients);

  const matchedIngredients = matchIngredients(mainIngredients);

  const publicDataTargetNames = createPublicDataTargetNames(matchedIngredients);

  console.log("공공데이터 조회 대상:");
  console.log(publicDataTargetNames);

  const publicDataResults = await Promise.all(
    publicDataTargetNames.map((ingredientName) =>
      enrichIngredientWithPublicData(ingredientName)
    )
  );

  const enrichedMatchedIngredients = matchedIngredients.map((item) => {
    const ingredientName = item.standardName || item.originalName;

    const publicData = publicDataResults.find(
      (result) => normalizeForCompare(result.ingredientName) === normalizeForCompare(ingredientName)
    );

    const hasPublicRestriction =
      (publicData?.restrictedInfo || []).length > 0 ||
      (publicData?.restrictedNationInfo || []).length > 0 ||
      (publicData?.regulationInfo || []).length > 0;

    const publicRestrictedReason = makePublicRestrictedReason(publicData);

    return {
      ...item,
      publicData: publicData || null,
      isRestricted: item.isRestricted || hasPublicRestriction,
      restrictedReason:
        item.restrictedReason || publicRestrictedReason || "",
      riskWeight:
        item.riskWeight > 0
          ? item.riskWeight
          : hasPublicRestriction
          ? 20
          : 0,
    };
  });

  const riskResult = calculatePersonalRiskScore(
    enrichedMatchedIngredients,
    userProfile
  );

  const cautionIngredients = enrichedMatchedIngredients
    .filter((item) => item.isRestricted || item.isAllergen)
    .map((item) => item.standardName || item.originalName);

  return {
    productName: extractProductName(ocrText),
    riskScore: riskResult.riskScore,
    riskLevel: riskResult.riskLevel,
    cautionIngredients: uniqueArray(cautionIngredients),
    mainIngredients,
    matchedIngredients: enrichedMatchedIngredients,
    riskReasons: makeRiskReasonsWithPublicData(
      riskResult.reasons,
      enrichedMatchedIngredients
    ),
    summary: makeSummary(cautionIngredients, mainIngredients),
    recommendation: makeRecommendation(
      riskResult.riskLevel,
      cautionIngredients
    ),
  };
}

function createPublicDataTargetNames(matchedIngredients) {
  const targetNames = [];

  matchedIngredients.forEach((item) => {
    const name = item.standardName || item.originalName;

    if (name && isValidIngredient(name)) {
      targetNames.push(name);
    }
  });

  const cautionNames = matchedIngredients
    .filter((item) => item.isRestricted || item.isAllergen)
    .map((item) => item.standardName || item.originalName)
    .filter(Boolean);

  return uniqueArray([...targetNames, ...cautionNames]).slice(
    0,
    PUBLIC_DATA_LOOKUP_LIMIT
  );
}

function makePublicRestrictedReason(publicData) {
  if (!publicData) return "";

  const restrictedInfo = publicData.restrictedInfo || [];
  const restrictedNationInfo = publicData.restrictedNationInfo || [];
  const regulationInfo = publicData.regulationInfo || [];

  const restricted = restrictedInfo[0];
  if (restricted) {
    return (
      restricted.LIMIT_COND ||
      restricted.PROVIS_ATRCL ||
      "공공데이터 기준 사용제한 원료 정보가 확인되었습니다."
    );
  }

  const restrictedNation = restrictedNationInfo[0];
  if (restrictedNation) {
    return `${restrictedNation.COUNTRY_NAME || "일부 국가"}에서 ${
      restrictedNation.LIMIT_COND || "제한 조건"
    } 정보가 확인되었습니다.`;
  }

  const regulation = regulationInfo[0];
  if (regulation) {
    return `공공데이터 규제정보 기준 금지국가: ${
      regulation.PROH_NATIONAL || "없음"
    }, 제한국가: ${regulation.LIMIT_NATIONAL || "없음"}`;
  }

  return "";
}

function makeRiskReasonsWithPublicData(localReasons, matchedIngredients) {
  const publicReasons = [];

  matchedIngredients.forEach((item) => {
    const ingredientName = item.standardName || item.originalName;
    const publicData = item.publicData;

    if (!publicData) return;

    const restrictedInfo = publicData.restrictedInfo || [];
    const restrictedNationInfo = publicData.restrictedNationInfo || [];
    const regulationInfo = publicData.regulationInfo || [];

    restrictedInfo.forEach((info) => {
      publicReasons.push({
        ingredient: ingredientName,
        type: "public_restricted",
        reason:
          info.LIMIT_COND ||
          info.PROVIS_ATRCL ||
          "공공데이터 기준 사용제한 원료 정보가 확인되었습니다.",
      });
    });

    restrictedNationInfo.forEach((info) => {
      publicReasons.push({
        ingredient: ingredientName,
        type: "public_restricted_nation",
        reason: `${info.COUNTRY_NAME || "일부 국가"}에서 ${
          info.LIMIT_COND || "제한 조건"
        } 정보가 확인되었습니다.`,
      });
    });

    regulationInfo.forEach((info) => {
      const prohNational = info.PROH_NATIONAL;
      const limitNational = info.LIMIT_NATIONAL;

      if (prohNational || limitNational) {
        publicReasons.push({
          ingredient: ingredientName,
          type: "public_regulation",
          reason: `공공데이터 규제정보 기준 금지국가: ${
            prohNational || "없음"
          }, 제한국가: ${limitNational || "없음"}`,
        });
      }
    });
  });

  return [...(localReasons || []), ...publicReasons];
}

function extractProductName(text) {
  const normalized = normalizeText(text);

  const productNamePatterns = [
    /제품명[:：]?\s*([^•*\n]+)/,
    /제품명\s*([^•*\n]+)/,
    /Product Name[:：]?\s*([^•*\n]+)/i,
  ];

  for (const pattern of productNamePatterns) {
    const match = normalized.match(pattern);

    if (match && match[1]) {
      return cleanText(match[1]).slice(0, 30);
    }
  }

  return "OCR 분석 제품";
}

function extractIngredientSection(text) {
  let normalized = normalizeText(text);
  normalized = correctOcrText(normalized);

  const startKeywords = [
    "전성분",
    "유효성분",
    "기타첨가제",
    "첨가제",
    "Ingredients",
    "INGREDIENTS",
  ];

  const endKeywords = [
    "효능효과",
    "효능 효과",
    "효능",
    "효과",
    "용법용량",
    "용법 용량",
    "용법",
    "용량",
    "사용상의 주의사항",
    "사용상 주의사항",
    "사용상의",
    "주의사항",
    "주의",
    "보관",
    "사용방법",
    "사용 방법",
    "충치예방",
    "구취",
    "심미효과",
    "치아를",
    "이를희게",
  ];

  let startIndex = -1;
  let matchedStartKeyword = "";

  for (const keyword of startKeywords) {
    const index = normalized.indexOf(keyword);

    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
      matchedStartKeyword = keyword;
    }
  }

  if (startIndex === -1) {
    return removeUnnecessarySections(normalized);
  }

  let section = normalized.slice(startIndex + matchedStartKeyword.length);

  let endIndex = -1;

  for (const keyword of endKeywords) {
    const index = section.indexOf(keyword);

    if (index !== -1 && index > 0 && (endIndex === -1 || index < endIndex)) {
      endIndex = index;
    }
  }

  if (endIndex !== -1) {
    section = section.slice(0, endIndex);
  }

  section = removeUnnecessarySections(section);

  return cleanText(section);
}

function removeUnnecessarySections(text) {
  let result = text;

  const removePatterns = [
    /제품명[:：]?.*?(?=전성분|유효성분|기타첨가제|첨가제|Ingredients|INGREDIENTS|$)/,
    /효능효과.*$/g,
    /효능 효과.*$/g,
    /용법용량.*$/g,
    /용법 용량.*$/g,
    /사용상의 주의사항.*$/g,
    /사용상 주의사항.*$/g,
    /주의사항.*$/g,
    /충치예방.*$/g,
    /구취.*$/g,
    /심미효과.*$/g,
    /치아를.*$/g,
    /이를희게.*$/g,
    /보관.*$/g,
  ];

  for (const pattern of removePatterns) {
    result = result.replace(pattern, " ");
  }

  return cleanText(result);
}

function extractIngredients(text) {
  const correctedText = correctOcrText(text);

  const cleaned = cleanText(correctedText)
    .replace(/전성분|유효성분|기타첨가제|첨가제|Ingredients|INGREDIENTS/gi, " ")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/[0-9]+ppm/gi, " ")
    .replace(/[0-9]+%/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[_~^]/g, " ")
    .trim();

  const chunks = cleaned
    .split(/[,，ㆍ·|]/)
    .map((item) => cleanIngredientName(item))
    .filter(Boolean);

  const ingredients = chunks.flatMap(splitIngredientChunk);

  return uniqueArray(
    ingredients
      .map((item) => cleanIngredientName(correctOcrIngredientName(item)))
      .filter(isValidIngredient)
  ).slice(0, 20);
}

function splitIngredientChunk(chunk) {
  const correctedChunk = cleanIngredientName(correctOcrIngredientName(chunk));

  if (!correctedChunk) return [];

  const knownMatches = extractKnownIngredients(correctedChunk);

  if (knownMatches.length > 0) {
    return knownMatches;
  }

  if (correctedChunk.includes(" ")) {
    return correctedChunk
      .split(/\s+/)
      .map((item) => cleanIngredientName(item))
      .filter(isValidIngredient);
  }

  return [correctedChunk];
}

function extractKnownIngredients(text) {
  const normalized = text.replace(/\s+/g, "");

  const knownIngredients = [
    "플루오르화나트륨",
    "피로인산나트륨",
    "탄산수소나트륨",
    "덴탈타입실리카",
    "소르비톨액",
    "글리세린",
    "함수이산화규소",
    "향료",
    "사카린나트륨",
    "셀룰로오스검",
    "라우릴황산나트륨",
    "라우로일사르코신나트륨",
    "산화티탄",
    "정제수",
    "부틸렌글라이콜",
    "프로판다이올",
    "판테놀",
    "나이아신아마이드",
    "병풀추출물",
    "알란토인",
    "히알루론산",
    "세라마이드",
    "에탄올",
    "변성알코올",
    "페녹시에탄올",
    "리모넨",
    "리날룰",
    "시트랄",
    "제라니올",
    "벤질알코올",
    "메틸파라벤",
    "프로필파라벤",
  ];

  const matches = knownIngredients.filter((ingredient) =>
    normalized.includes(ingredient)
  );

  return uniqueArray(matches);
}

function correctOcrText(text) {
  let result = String(text || "");

  const correctionPairs = [
    ["플루오르하나트륨", "플루오르화나트륨"],
    ["플루오르나트륨", "플루오르화나트륨"],
    ["탄산수소나트름", "탄산수소나트륨"],
    ["나트륭", "나트륨"],
    ["라우로 일사르코신나트륨", "라우로일사르코신나트륨"],
    ["라우로일 사르코신나트륨", "라우로일사르코신나트륨"],
    ["덴탈타입 실리카", "덴탈타입실리카"],
    ["셀룰로오스 검", "셀룰로오스검"],
    ["산화티탄", "산화티탄"],
    ["소르비톨액 SH", "소르비톨액"],
    ["소르비톨액 S H", "소르비톨액"],
    ["함수 이산화규소", "함수이산화규소"],
    ["피로 인산나트륨", "피로인산나트륨"],
    ["사카린 나트륨", "사카린나트륨"],
  ];

  correctionPairs.forEach(([wrong, right]) => {
    result = result.split(wrong).join(right);
  });

  return result;
}

function correctOcrIngredientName(text) {
  return correctOcrText(text)
    .replace(/\bSH\b/gi, "")
    .replace(/\bS H\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIngredientName(text) {
  return String(text || "")
    .replace(/[^\w가-힣\s\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidIngredient(item) {
  if (!item) return false;
  if (item.length < 2) return false;
  if (item.length > 35) return false;

  const invalidWords = [
    "제품명",
    "효능",
    "효과",
    "용법",
    "용량",
    "주의",
    "주의사항",
    "사용",
    "보관",
    "어린이",
    "의사",
    "치과의사",
    "상담",
    "경우",
    "금지",
    "한다",
    "있다",
    "없다",
    "사용할",
    "사용하지",
    "삼키지",
    "치약",
    "구강",
    "충치",
    "예방",
    "구취",
    "심미",
    "적당량",
    "제조원",
    "소비자",
    "분쟁",
    "문의사항",
  ];

  return !invalidWords.some((word) => item.includes(word));
}

function makeSummary(cautionIngredients, mainIngredients) {
  const uniqueCautionIngredients = uniqueArray(cautionIngredients);

  if (mainIngredients.length === 0) {
    return "OCR로 성분을 충분히 추출하지 못했습니다. 성분표 영역만 더 선명하게 촬영해 주세요.";
  }

  if (uniqueCautionIngredients.length > 0) {
    return `${uniqueCautionIngredients.join(
      ", "
    )} 성분이 감지되어 주의가 필요합니다.`;
  }

  return "현재 기준에서는 특별한 주의 성분이 적게 감지되었습니다.";
}

function makeRecommendation(riskLevel, cautionIngredients) {
  const uniqueCautionIngredients = uniqueArray(cautionIngredients);

  if (riskLevel === "high") {
    return "주의 성분이 많아 민감 피부 사용자는 사용 전 성분을 다시 확인하는 것이 좋습니다.";
  }

  if (riskLevel === "medium") {
    if (uniqueCautionIngredients.length > 0) {
      return "민감 피부이거나 알레르기 이력이 있다면 사용 전 패치 테스트를 권장합니다.";
    }

    return "일부 성분은 개인 피부 상태에 따라 다르게 반응할 수 있으므로 사용 전 확인이 필요합니다.";
  }

  return "사용자 설정 기준에서는 비교적 무난하게 사용할 수 있는 제품으로 보입니다.";
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[“”"']/g, "")
    .trim();
}

function normalizeForCompare(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

function uniqueArray(array) {
  return [...new Set(array)];
}

function safeJsonParse(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

app.use((error, req, res, next) => {
  console.error("서버 미들웨어 오류:");
  console.error(error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "이미지 파일 크기가 너무 큽니다. 10MB 이하 이미지를 사용해주세요.",
    });
  }

  return res.status(500).json({
    message: "서버 오류가 발생했습니다.",
    error: error.message,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SafeLabel CLOVA OCR API running on http://localhost:${PORT}`);
});