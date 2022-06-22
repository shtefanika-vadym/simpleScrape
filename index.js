const puppeteer = require('puppeteer')

const scrapeResearchGate = async (author, selectedUserAuthors) => {
  let isCycle = true
  author = author.replaceAll('-', '+');
  const result = [];
  try {
    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      devtools: false,
    });
    const page = await browser.newPage();
    const URL_AUTHORS = `https://scholar.google.ro/citations?hl=ro&view_op=search_authors&mauthors=${author}&btnG=`;
    await Promise.all([
      page.goto(URL_AUTHORS),
      page.waitForNavigation(),
    ]);

    const authors = await page.evaluate(async (person) => {
      const result = [];
      try {
        const author = document.querySelectorAll('#gs_bdy > #gs_bdy_ccl > #gsc_sa_ccl > .gsc_1usr > .gs_ai');
        author.forEach((curAuthor) => {
          const objAuthor = {};
          const authorName = curAuthor.querySelector('#gsc_sa_ccl > .gsc_1usr > .gs_ai > .gs_ai_t > .gs_ai_name > a').innerHTML;
          const authorDetails = curAuthor.querySelector('#gsc_sa_ccl > .gsc_1usr > .gs_ai > .gs_ai_t > .gs_ai_aff').innerHTML;
          const authorPhoto = curAuthor.querySelector('.gsc_1usr > .gs_ai > .gs_ai_pho > .gs_rimg > img').src;
          const authorLink = curAuthor.querySelector('.gsc_1usr > .gs_ai > .gs_ai_t > .gs_ai_name > a').href;

          if (authorName.replace('<span class="gs_hlt">', '')
              .replace('</span>', '').toLowerCase().includes(person.split('+').join(' ').toLowerCase())
            || authorName.replace('<span class="gs_hlt">', '')
              .replace('</span>', '').toLowerCase().includes(person.split('+').reverse().join(' ').toLowerCase())) {
            objAuthor.authorName = authorName.replace('<span class="gs_hlt">', '').replace('</span>', '');
            objAuthor.authorDetails = authorDetails.replace('<span class="gs_hlt">', '').replace('</span>', '').replace('&nbsp;…', '');
            objAuthor.authorPhoto = authorPhoto;
            objAuthor.authorLink = authorLink;
            result.push(objAuthor);
          }
        });
      } catch (e) {
        console.log(e);
      }
      if (result.length === 0) {
        return {message: `No result for "${person.split('+').join(' ').toUpperCase()}"`};
      }
      return result;
    }, author);

    if (authors?.length === 1) selectedUserAuthors = 0;

    const permutator = (inputArr) => {
      let result = [];
      const permute = (arr, m = []) => {
        if (arr.length === 0) {
          result.push(m)
        } else {
          for (let i = 0; i < arr.length; i++) {
            let curr = arr.slice();
            let next = curr.splice(i, 1);
            permute(curr.slice(), m.concat(next))
          }
        }
      }

      permute(inputArr)
      return result;
    }
    const allExamplesAuthor = permutator(author.split(('+')))

    if (authors?.message) {
      let totalArticles = 0
      while (isCycle) {
        const URL_SEARCH = `https://scholar.google.ro/scholar?start=${totalArticles}&q=${author}&hl=ro&as_sdt=1,5`;
        await Promise.all([
          page.goto(URL_SEARCH),
          page.waitForNavigation(),
        ]);
        const findedPosts = await page.evaluate(async (allExamplesAuthor) => {
          const result = [];
          try {
            const googlePosts = document.querySelectorAll('#gs_res_ccl_mid > div');
            googlePosts.forEach((post) => {
              const objData = {};
              const authorDetails = post.querySelector('#gs_res_ccl_mid > div > div.gs_ri > div.gs_a');
              const authorsPost = authorDetails.textContent.split('-')[0].trim().split(',').map(authorCurr=> authorCurr
                .replace('…', '').trim().toLowerCase())
              for (let i = 0; i < authorsPost.length; i++) {
                const currAuthor = authorsPost[i].split(' ')
                ref:for (let j = 0; j < allExamplesAuthor.length; j++) {
                  const possibleAuthor = allExamplesAuthor[j]
                  for (let k = 0; k < possibleAuthor.length; k++) {
                    const possibleAuthorName = possibleAuthor[k]
                    if (currAuthor.includes(possibleAuthorName)) {
                      const otherInitial = possibleAuthor
                        .filter(initial => initial !== possibleAuthorName)
                        .map(authorIni=>authorIni[0])
                      if(
                        currAuthor[0] === otherInitial.join('') ||
                        currAuthor[0] === otherInitial.reverse().join('')
                      ) {
                        const titlePublication = post.querySelector('#gs_res_ccl_mid > div > div.gs_ri > h3 > a')
                        const contentPublication = post.querySelector('#gs_res_ccl_mid > div > div.gs_ri > div.gs_rs')
                        objData.titlePublication = titlePublication?.innerHTML
                        objData.linkPublication = titlePublication?.href
                        objData.contentPublication = contentPublication?.textContent
                        console.log(objData)
                        break ref
                      }
                    }
                  }

                }
              }
              result.push(objData);
            });
          } catch (e) {
            console.log(e);
          }
          return result;
        }, allExamplesAuthor);
        if (findedPosts.filter((value) => Object.keys(value).length !== 0).length === 0) isCycle = false
        totalArticles = totalArticles + 10;
        console.log(totalArticles)
      }
    }

    if (selectedUserAuthors >= 0) {
      const URLSelectedAuthorOfUSer = authors[selectedUserAuthors].authorLink;
      await Promise.all([
        page.goto(URLSelectedAuthorOfUSer),
        page.waitForNavigation(),
      ]);
      let cycleButton = true;
      while (cycleButton) {
        await page.waitForSelector('form > #gsc_lwp > #gsc_bpf > #gsc_bpf_more > .gs_wr');
        const is_disabled = await page.$$eval('form > #gsc_lwp > #gsc_bpf > button[disabled]', (buttons) => buttons.length !== 0);
        if (!is_disabled) await page.click('form > #gsc_lwp > #gsc_bpf > #gsc_bpf_more > .gs_wr');
        else cycleButton = false;
      }

      const results = await page.evaluate(async () => {
        const result = [];
        const resultInfoPerson = [];
        try {
          const authorName = document.querySelector('#gsc_prf_in');
          const authorDetails = document.querySelector('#gsc_bdy > #gsc_prf_w > #gsc_prf > #gsc_prf_i > .gsc_prf_il:nth-child(2)');
          const authorPhoto = document.querySelector('#gsc_prf_pua > img');

          resultInfoPerson.push({
            authorName: authorName.innerHTML,
            authorDetails: authorDetails.innerHTML
              .replace('<a href="/citations?view_op=view_org&amp;hl=ro&amp;org=14482294840759683497" class="gsc_prf_ila">', '')
              .replace('</a>', ''),
            authorPhoto: authorPhoto.src,
          });

          const div = document.querySelectorAll('#gsc_a_tw > #gsc_a_t > #gsc_a_b > .gsc_a_tr');
          div.forEach((post) => {
            const objData = {};
            const titlePublication = post.querySelector('#gsc_a_t > #gsc_a_b > .gsc_a_tr > .gsc_a_t > .gsc_a_at');
            const dataPublication = post.querySelector('#gsc_a_t > #gsc_a_b > .gsc_a_tr > .gsc_a_y > .gsc_a_h');
            const authorPublication = post.querySelector('#gsc_a_t > #gsc_a_b > .gsc_a_tr > .gsc_a_t > .gs_gray:nth-child(2)');
            const otherDetails = post.querySelector('#gsc_a_t > #gsc_a_b > .gsc_a_tr > .gsc_a_t > .gs_gray:nth-child(3)').innerHTML;
            objData.dataPublication = Number.parseInt(dataPublication.innerHTML);
            objData.titlePublication = titlePublication?.innerHTML;
            objData.linkPublication = titlePublication?.href;
            objData.contentPublication = `${otherDetails.replace('<span class="gs_oph">', '')
              .replace('</span>', '').replace('&nbsp;…', '').replace('&amp;', '')}...`;

            objData.authorsPublication = authorPublication.innerHTML;

            objData.scrapingSite = 'https:scholar.google.ro';

            result.push(objData);
          });
        } catch (e) {
          console.log(e);
        }
        return [resultInfoPerson, ...result];
      });
      result.push(...results);
      // await browser.close();
    } else {
      // await browser.close();

      if (authors.length === 0) {
        const jsonResult = {};
        jsonResult.googleScholar = [{message: 'No scrapping Result'}];
        return jsonResult;
      }
      const jsonResult = {};
      jsonResult.googleScholar = authors;
      return jsonResult;
    }
  } catch
    (e) {
    console.log(e);
  }

  if (result.length === 0) {
    const jsonResult = {};
    jsonResult.googleScholar = [{message: 'No scrapping Result'}];
    return jsonResult;
  }
  const jsonResult = {};
  jsonResult.googleScholar = result;
  return jsonResult;
}


scrapeResearchGate('turcu-cornel-octavian').then(data => {
  console.log(data);
})