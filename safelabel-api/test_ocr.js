const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function main() {
  try {
    const imagePath = path.resolve(__dirname, '..', 'assets', 'images', 'tutorial-web.png');
    if (!fs.existsSync(imagePath)) {
      console.error('이미지 파일을 찾을 수 없습니다:', imagePath);
      process.exit(1);
    }

    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    form.append('skinType', '건성');
    form.append('sensitivity', '민감');
    form.append('allergies', JSON.stringify(['라놀린']));

    const res = await axios.post('http://localhost:4000/api/ocr/analyze', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Status:', err.response.status);
      try { console.error('Body:', JSON.stringify(err.response.data, null, 2)); } catch(e){ console.error('Body:', err.response.data); }
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
}

main();
