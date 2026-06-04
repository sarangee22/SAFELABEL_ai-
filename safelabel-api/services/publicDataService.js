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
    });

    const items = normalizePublicDataResponse(response.data);

    console.log(`${label} API 결과 수:`, items.length);

    return items;
  } catch (error) {
    console.log(`${label} API 호출 실패:`, error.message);
    return [];
  }
}

function normalizePublicDataResponse(data) {
  const items =
    data?.response?.body?.items?.item ||
    data?.body?.items?.item ||
    data?.items?.item ||
    data?.response?.body?.items;

  if (!items) return [];

  if (Array.isArray(items)) return items;

  return [items];
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "")
    .toLowerCase()
    .trim();
}

function isIngredientMatched(ingredientName, item) {
  const target = normalizeText(ingredientName);

  if (!target) return false;

  const candidates = [
    item.INGR_KOR_NAME,
    item.INGR_STD_NAME,
    item.NOTICE_INGR_NAME,
    item.INGR_ENG_NAME,
    item.INGR_SYNONYM,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[,，ㆍ·/|]/))
    .map(normalizeText)
    .filter(Boolean);

  return candidates.some((candidate) => {
    return (
      candidate === target ||
      candidate.includes(target) ||
      target.includes(candidate)
    );
  });
}

async function searchIngredientInfo(ingredientName) {
  return requestPublicData(
    API_URLS.ingredientInfo,
    {
      pageNo: 1,
      numOfRows: 10,
      INGR_KOR_NAME: ingredientName,
    },
    `원료성분정보(${ingredientName})`
  );
}

async function getRestrictedInfoList() {
  if (restrictedCache) return restrictedCache;

  if (!restrictedCachePromise) {
    restrictedCachePromise = requestPublicData(
      API_URLS.restrictedInfo,
      {
        pageNo: 1,
        numOfRows: 1000,
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
        numOfRows: 1000,
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
        numOfRows: 1000,
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
  const [ingredientInfo, restrictedInfo, restrictedNationInfo, regulationInfo] =
    await Promise.all([
      searchIngredientInfo(ingredientName),
      searchRestrictedInfo(ingredientName),
      searchRestrictedNationInfo(ingredientName),
      searchRegulationInfo(ingredientName),
    ]);

  return {
    ingredientName,
    ingredientInfo,
    restrictedInfo,
    restrictedNationInfo,
    regulationInfo,
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