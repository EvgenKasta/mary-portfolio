export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } }, // увеличен лимит на большие изображения
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, desc, price, images } = req.body;

  if (password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // формат: username/repo

  try {
    const uploadedUrls = [];

    // Загружаем изображения
    for (const img of images) {
      const fileName = `image-${Date.now()}-${Math.floor(Math.random() * 9999)}.jpg`;
      const base64Data = img.split(',')[1]; // убираем префикс "data:image/..."

      const uploadRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/images/${fileName}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add image ${fileName}`,
            content: base64Data,
          }),
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`GitHub upload failed: ${errText}`);
      }

      uploadedUrls.push(`https://raw.githubusercontent.com/${repo}/main/public/images/${fileName}`);
    }

    // Получаем текущий artworks.json
    const artworksRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/public/artworks.json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!artworksRes.ok) throw new Error('Failed to fetch artworks.json');
    const artworksData = await artworksRes.json();
    const contentJson = JSON.parse(Buffer.from(artworksData.content, 'base64').toString('utf-8'));

    // Добавляем новую работу
    contentJson.push({
      slides: uploadedUrls,
      desc,
      price,
    });

    // Обновляем artworks.json на GitHub
    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/public/artworks.json`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Update artworks.json',
          content: Buffer.from(JSON.stringify(contentJson, null, 2)).toString('base64'),
          sha: artworksData.sha,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Failed to update artworks.json: ${errText}`);
    }

    res.status(200).json({ success: true, urls: uploadedUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
