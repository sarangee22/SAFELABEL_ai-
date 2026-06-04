const axios = require("axios");

const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY;

const API_URLS = {
  ingredientInfo:
    "https://apis.data.go.kr/1471000/CsmtcsIngdCpntInfoService01/getCsmtcsIngdCpntInfoService01",

  restrictedInfo:
    "https://apis.data.go.kr/1471000/CsmtcsUseRstrcInfoService/getCsmtcsUseRstrcInfoService",

  restrictedNationInfo:
    "https://apis.data.go.kr/1471000/CsmtcsUseRstrcInfoService/getCsmtcsUseRstrcNatnInfoService",

  regulationInfo:
    "https://apis.data.go.kr/1471000/CsmtcsReglMaterialInfoService/getCsmtcsReglMaterialInfoService",
};

let restrictedCache = null;
let restrictedCachePromise = null;

let restrictedNationCache = null;
let restrictedNationCachePromise = null;

let regulationCache = null;
let regulationCachePromise = null;

function buildPublicDataUrl(baseUrl, params = {}) {
  if (!SERVICE_KEY) {
    throw new Error("DATA_GO_KR_SERVICE_KEY가 .env에 없습니다.");
  }

  const query = new URLSearchParams();

  query.append("serviceKey", SERVICE_KEY);
  query.append("pageNo", String(params.pageNo || 1));
  query.append("numOfRows", String(params.numOfRows || 100));
  query.append("type", "json");

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !["pageNo", "numOfRows", "type"].includes(key)
    ) {
      query.append(key, String(value));
    }
  });

  const queryString = query
    .toString()
    .replace(encodeURIComponent(SERVICE_KEY), SERVICE_KEY);

  return `${baseUrl}?${queryString}`;
}

async function requestPublicData(baseUrl, params = {}, label = "공공데이터") {
  try {
    const url = buildPublicDataUrl(baseUrl, params);

    console.log(`${label} API 호출:`, url.replace(SERVICE_KEY, "SERVICE_KEY"));

    const response = await axios.get(url, {
      timeout: 10000,
      responseType: "json",
      validateStatus: () => true,
    });

    console.log(`${label} HTTP 상태:`, response.status);

    const apiError = getPublicDataApiError(response.data);

    if (apiError) {
      console.log(`${label} API 응답 오류:`, apiError);
      return [];
    }

    const items = normalizePublicDataResponse(response.data);

    console.log(`${label} API 결과 수:`, items.length);

    if (items.length > 0) {
      console.log(`${label} 첫 번째 결과:`);
      console.log(JSON.stringify(items[0], null, 2).slice(0, 1200));
    }

    return items;
  } catch (error) {
    console.log(`${label} API 호출 실패:`, error.message);
    return [];
  }
}

function getPublicDataApiError(data) {
  const header =
    data?.response?.header ||
    data?.header ||
    data?.OpenAPI_ServiceResponse?.cmmMsgHeader ||
    null;

  if (!header) return null;

  const resultCode =
    header.resultCode ||
    header.returnReasonCode ||
    header.errMsg ||
    header.resultMsg ||
    "";

  const resultMessage =
    header.resultMsg ||
    header.returnAuthMsg ||
    header.returnReasonCode ||
    header.errMsg ||
    "";

  const normalizedCode = String(resultCode || "").trim();

  if (
    normalizedCode &&
    normalizedCode !== "00" &&
    normalizedCode !== "NORMAL_SERVICE" &&
    normalizedCode !== "INFO-000"
  ) {
    return {
      resultCode,
      resultMessage,
    };
  }

  return null;
}

function normalizePublicDataResponse(data) {
  if (!data) return [];

  const candidates = [
    data?.body?.items,
    data?.body?.items?.item,

    data?.response?.body?.items,
    data?.response?.body?.items?.item,

    data?.body?.item,
    data?.response?.body?.item,

    data?.items,
    data?.items?.item,

    data?.item,
    data?.data,
    data?.body,
    data?.response?.body,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeItems(candidate);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function normalizeItems(items) {
  if (!items) return [];

  if (Array.isArray(items)) {
    return items.filter(Boolean);
  }

  if (typeof items === "object") {
    if (Array.isArray(items.item)) {
      return items.item.filter(Boolean);
    }

    if (items.item && typeof items.item === "object") {
      return [items.item];
    }

    const keys = Object.keys(items);
    const hasOnlyNumericKeys =
      keys.length > 0 && keys.every((key) => /^[0-9]+$/.test(key));

    if (hasOnlyNumericKeys) {
      return Object.values(items).filter(Boolean);
    }

    return [items];
  }

  return [];
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "")
    .toLowerCase()
    .trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\^*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value, maxLength) {
  const text = cleanText(value);

  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getFirstValue(items, fields) {
  const list = Array.isArray(items) ? items : [items];

  for (const item of list) {
    if (!item) continue;

    for (const field of fields) {
      const value = cleanText(item[field]);

      if (value) {
        return value;
      }
    }
  }

  return "";
}

function splitCandidateText(value) {
  return String(value || "")
    .split(/[,，ㆍ·/|;]/)
    .map(normalizeText)
    .filter(Boolean);
}

function isIngredientMatched(ingredientName, item) {
  const target = normalizeText(ingredientName);

  if (target.length < 3) return false;

  const candidates = [
    item.INGR_KOR_NAME,
    item.INGR_STD_NAME,
    item.NOTICE_INGR_NAME,
    item.INGR_ENG_NAME,
    item.INGR_SYNONYM,
    item.CAS_NO,
  ]
    .filter(Boolean)
    .flatMap(splitCandidateText);

  return candidates.some((candidate) => candidate === target);
}

function buildUserFriendlyPublicDataSummary(
  ingredientName,
  ingredientInfo = [],
  restrictedInfo = [],
  restrictedNationInfo = [],
  regulationInfo = []
) {
  const hasIngredientInfo = ingredientInfo.length > 0;
  const hasRestriction =
    restrictedInfo.length > 0 ||
    restrictedNationInfo.length > 0 ||
    regulationInfo.length > 0;
  const allNameSources = [ingredientInfo, restrictedInfo, regulationInfo].flat();
  const englishName = getFirstValue(allNameSources, ["INGR_ENG_NAME"]);
  const casNo = getFirstValue([ingredientInfo, restrictedInfo].flat(), [
    "CAS_NO",
  ]);
  const definition = limitText(
    getFirstValue(ingredientInfo, [
      "ORIGIN_MAJOR_KOR_NAME",
      "DEFINITION",
      "INGR_DESC",
      "INGR_SYNONYM",
    ]),
    160
  );
  const restrictionText = [
    getFirstValue(restrictedInfo, ["LIMIT_COND", "PROVIS_ATRCL"]),
    getFirstValue(restrictedNationInfo, ["LIMIT_COND", "PROVIS_ATRCL"]),
    getFirstValue(regulationInfo, ["LIMIT_NATIONAL", "PROH_NATIONAL"]),
  ]
    .filter(Boolean)
    .join(" ");
  const countries = [
    ...restrictedInfo.map((item) => cleanText(item.COUNTRY_NAME)),
    ...restrictedNationInfo.map((item) => cleanText(item.COUNTRY_NAME)),
    getFirstValue(regulationInfo, ["PROH_NATIONAL"]),
    getFirstValue(regulationInfo, ["LIMIT_NATIONAL"]),
  ].filter(Boolean);
  const countrySummary = countries.length
    ? limitText([...new Set(countries)].join(", "), 120)
    : hasRestriction
    ? "일부 국가 또는 기준에서 규제 정보가 확인되었습니다."
    : "";

  return {
    safetyLevel: hasRestriction ? "주의 필요" : "기본 정보 확인",
    englishName,
    casNo,
    definition,
    simpleSummary: hasRestriction
      ? "공공데이터에서 사용 제한 또는 국가별 규제 정보가 확인된 성분입니다."
      : hasIngredientInfo
      ? "공공데이터에서 원료성분 기본 정보가 확인된 성분입니다."
      : "공공데이터에서 직접 확인된 정보가 없습니다.",
    restrictionSummary: hasRestriction
      ? limitText(
          restrictionText ||
            "특정 제품 유형이나 사용 조건에 따라 제한될 수 있습니다.",
          180
        )
      : "",
    countrySummary,
    userAdvice: hasRestriction
      ? "일반 화장품 사용이 무조건 위험하다는 뜻은 아니지만, 민감 피부라면 사용 전 성분을 확인하고 소량 테스트를 권장합니다."
      : "공공데이터 기본 정보를 참고하되, 개인 피부 상태에 따라 반응이 다를 수 있습니다.",
    hasRestriction,
  };
}

function makeIngredientSearchKeywords(ingredientName) {
  const keyword = String(ingredientName || "").trim();

  const fallbackMap = {
    정제수: ["정제수"],
    글리세린: ["글리세린"],
    향료: ["향료"],
    셀룰로오스검: ["셀룰로오스검"],
    소르비톨액: ["소르비톨"],
    소르비톨: ["소르비톨"],
    사카린나트륨: ["사카린나트륨"],
    라우릴황산나트륨: ["라우릴황산나트륨"],
    라우로일사르코신나트륨: ["라우로일사르코신나트륨"],

    플루오르화나트륨: ["플루오르화나트륨", "플루오르나트륨", "불화나트륨"],
    피로인산나트륨: ["피로인산나트륨"],
    탄산수소나트륨: ["탄산수소나트륨", "중탄산나트륨"],

    덴탈타입실리카: ["실리카", "이산화규소"],
    함수이산화규소: ["이산화규소", "실리카"],
    이산화규소: ["이산화규소", "실리카"],
    실리카: ["실리카", "이산화규소"],

    산화티탄: ["산화티탄", "티타늄디옥사이드"],
    티타늄디옥사이드: ["티타늄디옥사이드", "산화티탄"],
  };

  return [...new Set([keyword, ...(fallbackMap[keyword] || [])])].filter(
    Boolean
  );
}

async function searchIngredientInfo(ingredientName) {
  if (normalizeText(ingredientName).length < 3) {
    return [];
  }

  const keywords = makeIngredientSearchKeywords(ingredientName);

  for (const keyword of keywords) {
    const result = await requestPublicData(
      API_URLS.ingredientInfo,
      {
        pageNo: 1,
        numOfRows: 10,
        INGR_KOR_NAME: keyword,
      },
      `원료성분정보(${keyword})`
    );

    if (result.length > 0) {
      const filtered = result.filter((item) =>
        isIngredientMatched(ingredientName, item)
      );

      if (filtered.length > 0) {
        return filtered.slice(0, 3);
      }

      return [];
    }
  }

  return [];
}

async function getRestrictedInfoList() {
  if (restrictedCache) return restrictedCache;

  if (!restrictedCachePromise) {
    restrictedCachePromise = requestPublicData(
      API_URLS.restrictedInfo,
      {
        pageNo: 1,
        numOfRows: 500,
      },
      "사용제한 원료정보"
    );
  }

  restrictedCache = await restrictedCachePromise;
  return restrictedCache;
}

async function getRestrictedNationInfoList() {
  if (restrictedNationCache) return restrictedNationCache;

  if (!restrictedNationCachePromise) {
    restrictedNationCachePromise = requestPublicData(
      API_URLS.restrictedNationInfo,
      {
        pageNo: 1,
        numOfRows: 500,
      },
      "사용제한 원료 국가정보"
    );
  }

  restrictedNationCache = await restrictedNationCachePromise;
  return restrictedNationCache;
}

async function getRegulationInfoList() {
  if (regulationCache) return regulationCache;

  if (!regulationCachePromise) {
    regulationCachePromise = requestPublicData(
      API_URLS.regulationInfo,
      {
        pageNo: 1,
        numOfRows: 500,
      },
      "화장품 규제정보"
    );
  }

  regulationCache = await regulationCachePromise;
  return regulationCache;
}

async function searchRestrictedInfo(ingredientName) {
  const list = await getRestrictedInfoList();

  return list.filter((item) => isIngredientMatched(ingredientName, item));
}

async function searchRestrictedNationInfo(ingredientName) {
  const list = await getRestrictedNationInfoList();

  return list.filter((item) => isIngredientMatched(ingredientName, item));
}

async function searchRegulationInfo(ingredientName) {
  const list = await getRegulationInfoList();

  return list.filter((item) => isIngredientMatched(ingredientName, item));
}

async function enrichIngredientWithPublicData(ingredientName) {
  if (normalizeText(ingredientName).length < 3) {
    return {
      ingredientName,
      ingredientInfo: [],
      restrictedInfo: [],
      restrictedNationInfo: [],
      regulationInfo: [],
      userSummary: buildUserFriendlyPublicDataSummary(ingredientName),
      hasPublicData: false,
    };
  }

  const [ingredientInfo, restrictedInfo, restrictedNationInfo, regulationInfo] =
    await Promise.all([
      searchIngredientInfo(ingredientName),
      searchRestrictedInfo(ingredientName),
      searchRestrictedNationInfo(ingredientName),
      searchRegulationInfo(ingredientName),
    ]);
  const userSummary = buildUserFriendlyPublicDataSummary(
    ingredientName,
    ingredientInfo,
    restrictedInfo,
    restrictedNationInfo,
    regulationInfo
  );

  return {
    ingredientName,
    ingredientInfo,
    restrictedInfo,
    restrictedNationInfo,
    regulationInfo,
    userSummary,
    hasPublicData:
      ingredientInfo.length > 0 ||
      restrictedInfo.length > 0 ||
      restrictedNationInfo.length > 0 ||
      regulationInfo.length > 0,
  };
}

module.exports = {
  searchIngredientInfo,
  searchRestrictedInfo,
  searchRestrictedNationInfo,
  searchRegulationInfo,
  enrichIngredientWithPublicData,
};
