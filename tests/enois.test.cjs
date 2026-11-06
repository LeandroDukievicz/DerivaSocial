const assert = require('node:assert/strict');
const test = require('node:test');
const { fetchPostHtml } = require('../dist/bloghtml.js');

test('busca o artigo publicado do blog para gerar HTML, sem seguir redirecionamentos', async (t) => {
  const original = global.fetch;
  let requested;
  global.fetch = async (url, options) => {
    requested = { url, options };
    return new Response('<article>Conteúdo completo</article>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  t.after(() => { global.fetch = original; });
  const result = await fetchPostHtml({ url: 'https://devsaderiva.com.br/posts/artigo-antigo?utm=x' });
  assert.equal(result.url, 'https://devsaderiva.com.br/posts/artigo-antigo');
  assert.match(result.html, /Conteúdo completo/);
  assert.equal(requested.options.redirect, 'error');
});

test('não busca posts futuros ou endereços fora do blog', async (t) => {
  const original = global.fetch;
  global.fetch = async () => { throw new Error('A rede não deveria ser acessada'); };
  t.after(() => { global.fetch = original; });
  await assert.rejects(fetchPostHtml({ url: 'https://devsaderiva.com.br/posts/a', upcoming: true }), /ainda não foi publicado/);
  for (const url of ['https://outro.example/posts/a', 'http://devsaderiva.com.br/posts/a', 'https://devsaderiva.com.br/api/posts']) {
    await assert.rejects(fetchPostHtml({ url }), /não é de um post/);
  }
});
