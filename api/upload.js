export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, desc, price, images } = req.body;

  if (password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  try {
    const uploadedUrls = [];

    for (const img of images) {
      const fileName = `image-${Date.now()}-${Math.floor(Math.random() * 9999)}.jpg`;

      // Извлекаем base64-данные
      const base64Data = img.replace(/^data:image\/\w+;base64,/, '');

      // Загружаем через GitHub API
      const uploadRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/images/${fileName}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `add ${fileName}`,
            content: base64Data,
          }),
        }
      );

      if (!uploadRes.ok) throw new Error('GitHub upload failed');
      uploadedUrls.push(
        `https://raw.githubusercontent.com/${repo}/main/public/images/${fileName}`
      );
    }

    // Загружаем artworks.json
    const artworksRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/public/artworks.json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const artworksData = await artworksRes.json();
    const content = JSON.parse(Buffer.from(artworksData.content, 'base64').toString('utf-8'));

    content.push({
      slides: uploadedUrls,
      desc,
      price,
    });

    // Обновляем artworks.json
    await fetch(`https://api.github.com/repos/${repo}/contents/public/artworks.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'update artworks.json',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        sha: artworksData.sha,
      }),
    });

    res.json({ success: true, urls: uploadedUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
