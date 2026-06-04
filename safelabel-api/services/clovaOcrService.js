const axios = require("axios");
const FormData = require("form-data");

/**
 * 네이버 CLOVA OCR API 호출
 * @param {Buffer} imageBuffer - 이미지 파일 버퍼
 * @param {string} fileName - 파일명
 * @returns {Promise<Object>}
 */
async function performClovaOCR(imageBuffer, fileName) {
  const invokeUrl = process.env.NAVER_OCR_INVOKE_URL;
  const secretKey = process.env.NAVER_OCR_SECRET_KEY;

  if (!invokeUrl || !secretKey) {
    throw new Error("환경 변수에 네이버 OCR API 키가 설정되지 않았습니다.");
  }

  const fileExtension = fileName.split(".").pop().toLowerCase() || "jpg";
  const format = fileExtension === "jpeg" ? "jpg" : fileExtension;

  const message = {
    images: [{ format: format, name: "cosmetic_label" }],
    requestId: String(Date.now()),
    version: "V2",
    timestamp: Date.now(),
  };

  const formData = new FormData();
  formData.append("message", JSON.stringify(message));
  formData.append("file", imageBuffer, { filename: fileName });

  const response = await axios.post(invokeUrl, formData, {
    headers: {
      ...formData.getHeaders(),
      "X-OCR-SECRET": secretKey,
    },
  });

  return response.data;
}

module.exports = { performClovaOCR };