const axios = require('axios');
require('dotenv').config();

const url = `${process.env.COSMETIC_INGREDIENT_API_URL}?serviceKey=${process.env.PUBLIC_DATA_SERVICE_KEY}&pageNo=1&numOfRows=100&type=json`;

(async () => {
  try {
    const response = await axios.get(url);
    const items = response.data?.body?.items;
    if (!items) {
      console.error('No items', JSON.stringify(response.data, null, 2));
      return;
    }
    if (!Array.isArray(items)) {
      console.log('1. ' + (items.INGR_KOR_NAME || items.INGR_NM || items.STDR_NM || ''));
      return;
    }
    items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.INGR_KOR_NAME || item.INGR_NM || item.STDR_NM || ''}`);
    });
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('RESPONSE:', JSON.stringify(error.response.data, null, 2));
    }
  }
})();
