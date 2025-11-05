const fetch = require('node-fetch'); // если используешь Vercel, fetch есть по умолчанию, можно убрать
const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, desc, price, images } = req.body;

  if (password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "username/repo-name"
  const branch = process.env.GITHUB_BRANCH || 'main'; // по умолчанию main

  try {
    const uploadedUrls = [];

    if (!images || !images.length) throw new Error('No images provided');

    // Загрузка изображений
    for (const img of images) {
      if (!img) continue;

      const fileName = `image-${Date.now()}-${Math.floor(Math.random() * 9999)}.jpg`;
      const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
      if (!base64Data) continue;

      const uploadRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/images/${fileName}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add ${fileName}`,
            content: base64Data,
            branch,
          }),
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error('GitHub upload failed: ' + errText);
      }

      uploadedUrls.push(`https://raw.githubusercontent.com/${repo}/${branch}/public/images/${fileName}`);
    }

    // Получение artworks.json
    let artworksData;
    try {
      const resArt = await fetch(`https://api.github.com/repos/${repo}/contents/public/artworks.json?ref=${branch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resArt.ok) throw new Error('Artworks file not found');

      artworksData = await resArt.json();
    } catch (err) {
      // Если файла нет — создаём пустой
      artworksData = { content: Buffer.from('[]').toString('base64'), sha: null };
    }

    let content = [];
    if (artworksData.content) {
      content = JSON.parse(Buffer.from(artworksData.content, 'base64').toString('utf-8'));
    }

    content.push({
      slides: uploadedUrls,
      desc,
      price,
    });

    // Обновление artworks.json
    const updateRes = await fetch(`https://api.github.com/repos/${repo}/contents/public/artworks.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update artworks.json',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        sha: artworksData.sha || undefined,
        branch,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error('Updating artworks.json failed: ' + errText);
    }

    res.json({ success: true, urls: uploadedUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = config;
