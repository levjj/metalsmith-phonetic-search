function tokens(string) {
    string = string.toLowerCase().replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ß/g, 'ss');
    const tokens = [];
    let matched = "";
    for (let i = 0; i <= string.length; i++) {
        if (i < string.length && /^[a-z]/.test(string[i])) {
            matched += string[i];
        } else if (matched.length > 0) {
            tokens.push(matched);
            matched = "";
        }
    }
    return tokens;
}

function metaphone(string) {
    // Assumes string is [a-z]+

    // Drop duplicate adjacent letters, except for C.
    let s1 = "", last = null;
    for (let i = 0; i < string.length; i++) {
        if (last !== string[i] || last === 'c') {
            s1 += string[i];
        }
        last = string[i];
    }
    string = s1;

    // If the word begins with 'KN', 'GN', 'PN', 'AE', 'WR', drop the first letter.
    string = string
        .replace(/$kn/g, "n")
        .replace(/$gn/g, "n")
        .replace(/$pn/g, "n")
        .replace(/$ae/g, "e")
        .replace(/$wr/g, "r");

    // Drop 'B' if after 'M' at the end of the word.
    string = string.replace(/mb$/, "m");

    // 'C' transforms to 'X' if followed by 'IA' or 'H' (unless in latter case, it is part of '-SCH-', in which case it transforms to 'K'). 'C' transforms to 'S' if followed by 'I', 'E', or 'Y'. Otherwise, 'C' transforms to 'K'.
    string = string
        .replace(/sch/g, "skh")
        .replace(/cia/g, "xia")
        .replace(/ch/g, "xh")
        .replace(/ci/g, "si")
        .replace(/ce/g, "se")
        .replace(/cy/g, "sy")
        .replace(/c/g, "k");

    // 'D' transforms to 'J' if followed by 'GE', 'GY', or 'GI'. Otherwise, 'D' transforms to 'T'.
    string = string
        .replace(/dge/g, "jge")
        .replace(/dgy/g, "jgy")
        .replace(/dgi/g, "jgi")
        .replace(/d/g, "t");

    // Drop 'G' if followed by 'H' and 'H' is not at the end or before a vowel. Drop 'G' if followed by 'N' or 'NED' and is at the end.
    string = string
        .replace(/g(h[^aeiou])/g, "$1")
        .replace(/gn/g, "n");

    // 'G' transforms to 'J' if before 'I', 'E', or 'Y', and it is not in 'GG'. Otherwise, 'G' transforms to 'K'.
    string = string
        .replace(/gg/g, "kk")
        .replace(/gi/g, "ji")
        .replace(/ge/g, "je")
        .replace(/gy/g, "jy")
        .replace(/g/g, "k");

    // Drop 'H' if after vowel and not before a vowel.
    string = string
        .replace(/([aeiou])h([^aeiou])/g, "$1$2");

    // 'CK' transforms to 'K'.
    string = string.replace(/ck/g, "k");

    // 'PH' transforms to 'F'.
    string = string.replace(/ph/g, "f");

    // 'Q' transforms to 'K'.
    string = string.replace(/q/g, "k");

    // 'S' transforms to 'X' if followed by 'H', 'IO', or 'IA'.
    string = string.replace(/s(h|io|ia)/g, "x$1");

    // 'T' transforms to 'X' if followed by 'IA' or 'IO'. 'TH' transforms to '0'. Drop 'T' if followed by 'CH'.
    string = string
        .replace(/t(io|ia)/g, "x$1")
        .replace(/th/g, "0")
        .replace(/tch/g, "ch");

    // 'V' transforms to 'F'.
    string = string.replace(/v/g, "f");

    // 'WH' transforms to 'W' if at the beginning. Drop 'W' if not followed by a vowel.
    string = string
        .replace(/^wh/g, "w")
        .replace(/w([^aeiou])/g, "$1");

    // 'X' transforms to 'S' if at the beginning. Otherwise, 'X' transforms to 'KS'.
    string = string
        .replace(/^x/g, "s")
        .replace(/x/g, "ks");

    // Drop 'Y' if not followed by a vowel.
    string = string.replace(/y([^aeiou])/g, "$1");

    // 'Z' transforms to 'S'.
    string = string.replace(/z/g, "s");

    // Drop all vowels unless it is the beginning.
    return string.length > 0 ? string[0] + string.substr(1).replace(/[aeiou]/g, "") : "";
}

function metaphoneScore(title, query, queryTokens, queryMetaphoneTokens) {
  let score = 0;
  if (title.toLowerCase().includes(query.toLowerCase)) {
    score += 100;
  }
  const titleTokens = tokens(title).filter(t => !!t);
  for (const kw of titleTokens) {
    if (queryTokens.includes(kw)) {
      score += 20 + Math.floor(40 / titleTokens.length);
    }
  }
  const titleMetaphoneTokens = tokens(query).map(t => metaphone(t)).filter(t => !!t);
  for (const kw of titleMetaphoneTokens) {
    if (queryMetaphoneTokens.includes(kw)) {
      score += 5 + Math.floor(10 / titleMetaphoneTokens.length);
    }
  }
  return score;
}

function compareWithQuery(query, queryTokens, queryMetaphoneTokens, searchData) {
  return function(firstElement, secondElement) {
    const firstElementTitle = searchData.entries[firstElement].title;
    const firstElementScore = metaphoneScore(firstElementTitle, query, queryTokens, queryMetaphoneTokens);
    const secondElementTitle = searchData.entries[secondElement].title;
    const secondElementScore = metaphoneScore(secondElementTitle, query, queryTokens, queryMetaphoneTokens);
    return firstElementScore < secondElementScore ? 1 : -1;
  };
}

function showResultsForQuery(query, searchData) {
  document.getElementById("searchQuery").innerText = query;
  const queryTokens = tokens(query).filter(t => !!t);
  const queryMetaphoneTokens = queryTokens.map(t => metaphone(t)).filter(t => !!t);

  const hits = new Set();
  for (const kw in searchData.index) {
    for (const st of queryMetaphoneTokens) {
      if (kw === st) {
        for (const hit of searchData.index[kw]) {
          hits.add(hit)
        }
      }
    }
  }
  const sortedHits = [...hits.values()];
  sortedHits.sort(compareWithQuery(query, queryTokens, queryMetaphoneTokens, searchData));

  const target = document.getElementById("searchResults");
  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }
  const numResults = document.createElement("p");
  numResults.innerText = `${sortedHits.length === 0 ? 'no' : sortedHits.length} results`;
  target.appendChild(numResults);
  for (const hit of sortedHits) {
    const details = searchData.entries[hit];
    const result = document.createElement("div");
    const resultHeader = document.createElement("h3");
    const title = document.createElement("a");
    title.setAttribute("href", details.url);
    title.innerText = details.title;
    resultHeader.appendChild(title);
    result.appendChild(resultHeader);
    const url = document.createElement("p");
    url.innerText = window.location.origin + details.url + ", " + details.date;
    result.appendChild(url);
    target.appendChild(result);
  }
}

function showResults(searchData) {
  const params = new URLSearchParams(document.location.search.substring(1));
  const searchParam = params.get("q");
  showResultsForQuery(searchParam, searchData);
  document.getElementById("q").addEventListener("input", evt => {
    showResultsForQuery(evt.target.value, searchData);
  });
}
