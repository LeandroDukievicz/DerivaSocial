const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'derivasocial-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('store serializes concurrent network updates and preserves history', async (t) => {
  const dir = await tempDir(t);
  const store = require('../dist/store.js');
  store.init(dir);
  await store.syncUpcoming([{
    slug: 'teste-concorrencia', title: 'Teste', excerpt: 'Resumo',
    blogScheduledAt: new Date().toISOString(),
  }]);
  const guid = 'https://devsaderiva.com.br/posts/teste-concorrencia';
  const results = await Promise.all(['linkedin', 'instagram', 'threads'].map((network) =>
    store.markPublished(guid, network, `https://example.test/${network}`)));
  assert.ok(results.every(Boolean));
  const post = await store.getPost(guid);
  assert.deepEqual(Object.keys(post.networks).sort(), ['instagram', 'linkedin', 'threads']);
  assert.equal(post.status, 'publicado');
  assert.equal((await fs.stat(path.join(dir, 'posts.json'))).mode & 0o777, 0o600);
});

test('store refuses to hide corrupt history', async (t) => {
  const dir = await tempDir(t);
  await fs.writeFile(path.join(dir, 'posts.json'), '{bad json');
  const store = require('../dist/store.js');
  store.init(dir);
  await assert.rejects(store.getPosts(), SyntaxError);
});

test('secrets store writes with owner-only permissions and rejects corrupt JSON', async (t) => {
  const dir = await tempDir(t);
  const appRoot = path.join(dir, 'app');
  const dataDir = path.join(dir, 'config');
  await fs.mkdir(appRoot);
  const secrets = require('../dist/secrets.js');
  await secrets.init(dataDir, appRoot);
  await secrets.save();
  assert.equal((await fs.stat(path.join(dataDir, 'secrets.json'))).mode & 0o777, 0o600);
  await fs.chmod(path.join(dataDir, 'secrets.json'), 0o664);
  await secrets.init(dataDir, appRoot);
  assert.equal((await fs.stat(path.join(dataDir, 'secrets.json'))).mode & 0o777, 0o600);
  await fs.writeFile(path.join(dataDir, 'secrets.json'), '{broken');
  await assert.rejects(secrets.init(dataDir, appRoot), SyntaxError);
});

test('thumbnail generator creates all supported formats with exact dimensions', async (t) => {
  const dir = await tempDir(t);
  const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#123456' } }).png().toBuffer();
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(image, { status: 200, headers: { 'content-type': 'image/png' } });
  t.after(() => { global.fetch = originalFetch; });
  const thumbnail = require('../dist/thumbnail.js');
  thumbnail.init(dir);
  const post = { guid: 'unit-test', title: 'Um titulo para testar', image: 'https://image.test/test.png', summary: '', discoveredAt: '', status: 'novo', networks: {} };
  for (const [format, width, height] of [['og', 1200, 630], ['square', 1080, 1080], ['story', 1080, 1920]]) {
    const result = await thumbnail.generate(post, { text: 'Teste visual', format });
    assert.deepEqual([result.width, result.height], [width, height]);
    assert.equal((await sharp(result.path).metadata()).format, 'png');
    assert.ok(thumbnail.isManagedPath(result.path));
  }
  assert.equal(thumbnail.isManagedPath(path.join(dir, 'outside.png')), false);
});

test('image candidates pad images outside Instagram aspect limits', async () => {
  const image = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#123456' } }).png().toBuffer();
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(image, { status: 200, headers: { 'content-type': 'image/png' } });
  try {
    const imagefit = require('../dist/imagefit.js');
    const urls = await imagefit.candidates('instagram', 'https://image.test/wide.png');
    assert.equal(urls.length, 2);
    assert.match(urls[0], /w=1080&h=566/);
    assert.match(urls[1], /w=1080&h=1080/);
  } finally {
    global.fetch = originalFetch;
  }
});
