const axios = require('axios');
require('dotenv').config();

const url = process.env.COSMETIC_INGREDIENT_API_URL;
const params = {
  serviceKey: process.env.PUBLIC_DATA_SERVICE_KEY,
  pageNo: 1,
  numOfRows: 100,
  type: 'json',
};

(async () => {
  try {
    const res = await axios.get(url, { params });
    const items = res.data?.body?.items;
    const list = Array.isArray(items) ? items : [items];
    const found = list.filter((i) =>
      String(i.INGR_KOR_NAME || '').includes('구아노신') ||
      String(i.STDR_NM || '').includes('구아노신')
    );
    console.log('found', found.length);
    found.slice(0, 5).forEach((item) => console.log(JSON.stringify(item, null, 2)));
  } catch (error) {
    console.error(error.message);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
})();
