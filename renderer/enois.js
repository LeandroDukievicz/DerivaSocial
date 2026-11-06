(function () {
  const styles = `
    .dda-post{--bg:#020b18;--star:#00d4e8;--accent:#e800d4;--text:#e8f4f8;--reading:#d5d5d5;--dim:#8fa0ad;--line:rgba(0,212,232,.16);--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--bg);color:var(--reading);font:17px/1.75 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    .dda-post *{box-sizing:border-box;margin:0}.dda-post img{max-width:100%;display:block}
    .dda-header{position:relative;min-height:clamp(380px,70vh,660px);display:flex;align-items:flex-end;overflow:hidden;border-bottom:1px solid var(--line);background:#0a0410}
    .dda-header img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 28%}
    .dda-header i{position:absolute;inset:0;background:linear-gradient(to top,var(--bg) 2%,rgba(2,11,24,.92) 22%,rgba(2,11,24,.35) 55%,rgba(2,11,24,.55) 100%),radial-gradient(90% 60% at 20% 100%,rgba(232,0,212,.18),transparent 70%)}
    .dda-header div{position:relative;width:100%;max-width:860px;margin:0 auto;padding:0 clamp(18px,5vw,40px) clamp(30px,6vw,56px)}
    .dda-category{font-family:var(--mono);font-size:clamp(10px,1.4vw,12px);letter-spacing:.24em;text-transform:uppercase;color:var(--star);margin-bottom:14px!important}
    .dda-post h1{font-family:var(--mono);font-size:clamp(29px,6.2vw,56px);font-weight:700;line-height:1.08;letter-spacing:-.01em;color:var(--text);text-wrap:balance;margin-bottom:16px!important}
    .dda-excerpt{max-width:58ch;font-size:clamp(15px,2.2vw,19px);line-height:1.6;color:#c3d2dd}
    .dda-meta{max-width:860px;margin:0 auto;padding:9px clamp(18px,5vw,40px) 0;font:11px/1.75 var(--mono);letter-spacing:.08em;color:var(--dim)}
    .dda-body{max-width:720px;margin:0 auto;padding:clamp(30px,6vw,56px) clamp(18px,5vw,40px) clamp(56px,10vw,100px)}
    .dda-body p{margin:0 0 1.5em!important}.dda-body a{color:var(--star);text-decoration-color:rgba(0,212,232,.45);text-underline-offset:3px;overflow-wrap:anywhere}
    .dda-body strong{color:var(--text);font-weight:600}.dda-body em{color:#e3d7ea}.dda-body code{font-family:var(--mono);font-size:.86em;color:#4de1ef;word-break:break-all}
    .dda-body h2{font-family:var(--mono);font-size:clamp(20px,3.4vw,27px);font-weight:700;line-height:1.25;color:var(--text);text-wrap:balance;margin:2.6em 0 .9em!important}
    .dda-body h2:before{content:"";display:block;width:38px;height:2px;margin-bottom:.7em;background:linear-gradient(90deg,var(--star),var(--accent))}
    .dda-body h3,.dda-body h4{font-family:var(--mono);font-size:clamp(15px,2.3vw,18px);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--star);margin:2.2em 0 .7em!important}
    .dda-body>p:first-of-type:first-letter{float:left;margin:.06em .12em 0 0;font:700 3.1em/.82 var(--mono);color:var(--accent)}
    .dda-body blockquote{padding:4px 0 4px 22px;border-left:3px solid var(--accent);color:#c9bcd2;font-size:16px;line-height:1.7;margin:2em 0!important}
    .dda-body ul,.dda-body ol{padding-left:22px;margin:0 0 1.5em!important}.dda-body pre{padding:16px 18px;border:1px solid var(--line);border-radius:8px;background:rgba(0,212,232,.05);overflow-x:auto;margin:0 0 1.5em!important}
    .dda-body figure{display:flex;justify-content:center;margin:1.5em 0}.dda-body figure img{width:auto;max-height:680px;border-radius:14px;object-fit:contain}
    .dda-body hr{border:0;height:1px;background:linear-gradient(90deg,var(--line),transparent);margin:3.4em 0!important}
    .dda-source{max-width:720px;margin:0 auto;padding:0 clamp(18px,5vw,40px) 30px;font:13px/1.7 var(--mono);color:var(--dim)}.dda-source a{color:var(--star)}
    @media(max-width:560px){.dda-post{font-size:16px}.dda-header{min-height:clamp(320px,58vh,480px)}.dda-body>p:first-of-type:first-letter{font-size:2.6em}}
  `;

  function createHtml(pageHtml, url) {
    const document = new DOMParser().parseFromString(pageHtml, "text/html");
    const post = document.querySelector('.post-page');
    const body = post?.querySelector('.post-body');
    const title = post?.querySelector('.post-title');
    if (!post || !body || !title || !url) throw new Error('Não foi possível obter o conteúdo do post.');
    const article = document.createElement('article');
    article.className = 'dda-post';
    const header = document.createElement('header'); header.className = 'dda-header';
    const cover = post.querySelector('.post-hero-image');
    if (cover) {
      const img = document.createElement('img');
      img.setAttribute('src', cover.getAttribute('src') || ''); img.alt = cover.alt;
      header.append(img);
    }
    header.append(document.createElement('i'));
    const headerCopy = document.createElement('div'); header.append(headerCopy); article.append(header);
    const addText = (selector, tag, className) => {
      const value = post.querySelector(selector)?.textContent?.trim();
      if (!value) return;
      const element = document.createElement(tag); element.className = className; element.textContent = value; headerCopy.append(element);
    };
    addText('.post-back-label', 'p', 'dda-category');
    addText('.post-title', 'h1', 'dda-title');
    addText('.post-excerpt', 'p', 'dda-excerpt');
    const meta = document.createElement('p'); meta.className = 'dda-meta';
    meta.textContent = [post.querySelector('.post-author-name')?.textContent?.trim(), post.querySelector('.post-published-date')?.textContent?.trim()].filter(Boolean).join(' · ');
    article.append(meta);
    const content = body.cloneNode(true); content.className = 'dda-body'; article.append(content);
    const source = document.createElement('p'); source.className = 'dda-source';
    const link = document.createElement('a'); link.href = url; link.textContent = 'Leia o post original no Devs à Deriva'; source.append(link); article.append(source);
    article.querySelectorAll('[href], [src]').forEach((element) => {
      for (const attribute of ['href', 'src']) {
        const value = element.getAttribute(attribute);
        if (value && !value.startsWith('#')) {
          try { element.setAttribute(attribute, new URL(value, url).href); } catch { /* mantém o original */ }
        }
      }
    });
    return `<style>${styles}</style>\n${article.outerHTML}`;
  }

  window.createEnoisHtml = createHtml;
})();
