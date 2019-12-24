/**
 * Metalsmith Phonetic Search plugin to allow client-side searching of a site.
 *
 * Based of metalsmith-simple-search but uses metaphone matching.
 *
 * @example
 * var phoneticSearch = require("metalsmith-phonetic-search");
 *
 * // Create your metalsmith instace. When that is done, add the middleware
 * // like this.
 * metalsmith.use(phoneticSearch({
 *     // configuration here
 * }));
 *
 * @module metalsmith-phonetic-search
 * @see {@link https://github.com/connected-world-services/metalsmith-simple-search}
 */
"use strict";

/**
 * Metalsmith's file object.
 *
 * @typedef {Object} metalsmithFile
 * @property {Buffer} contents
 * @property {string} mode
 */

/**
 * Metalsmith's collection of files.
 *
 * @typedef {Object.<string,module:metalsmith-phonetic-search~metalsmithFile>} metalsmithFileCollection
 */

/**
 * Data used for searching for a single file.
 *
 * @property {string} url Associated URL in case the search finds something.
 */

var debug, fs, path, pluginKit, striptags, unescape;

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

/**
 * Creates the metadata for a single file object.
 *
 * The `options` passed may have altered `options.index` values. Only booleans
 * and functions are supported. Strings were converted into functions in
 * the factory middleware.
 *
 * @example
 * result = {};
 * Object.keys(files).forEach((filename) => {
 *     result[filename] = buildSearchData(files[filename], filename, options);
 * });
 *
 * @param {module:metalsmith-phonetic-search~metalsmithFile} file
 * @param {string} filename
 * @param {module:metalsmith-phonetic-search~options} options
 * @param {Object} searchData
 */
function index(file, filename, options, searchData) {

    const entry = {};
    const entryIndex = searchData.entries.length;
    if (!!file.title) {
        entry.title = Buffer.isBuffer(file.title) ? file.title.toString("utf8") : file.title.toString();
    }
    entry.url = options.transformUrl(filename);
    if (entry.url.endsWith("/index.html")) {
        entry.url = entry.url.substr(0, entry.url.length - "/index.html".length);
    }
    if (entry.url.endsWith(".html")) {
        entry.url = entry.url.substr(0, entry.url.length - ".html".length);
    }
    entry.date = file.date && file.date.toLocaleString('en-US', {month: 'long', year: 'numeric'});
    searchData.entries.push(entry);

    // Loop through the metadata properties
    Object.keys(options.index).forEach((metadataName) => {
        var cleansingFn, value;

        cleansingFn = options.index[metadataName];
        value = file[metadataName];

        if (!cleansingFn || !value) {
            // Skip if falsy cleansing function (meaning "do not index")
            // and skip if no data is available.
            return;
        }

        // First, convert to a string.
        if (Array.isArray(value)) {
            value = value.join(" ");
        } else if (Buffer.isBuffer(value)) {
            value = value.toString("utf8");
        } else {
            value = value.toString();
        }

        // Clean up the data and convert to the string that should be
        // saved in the search JSON data.
        value = cleansingFn(value);
        for (const term of tokens(value)) {
            let mp = metaphone(term);
            while (mp.length > 1) {
                if (!searchData.index.hasOwnProperty(mp)) {
                    searchData.index[mp] = [entryIndex];
                } else  {
                    const indexEntry = searchData.index[mp];
                    if (indexEntry[indexEntry.length - 1] !== entryIndex) {
                        indexEntry.push(entryIndex);
                    }
                }
                mp = mp.substr(0, mp.length - 1);
            }
        }
    });
}


debug = require("debug")("metalsmith-phonetic-search");
fs = require("fs");
path = require("path");
pluginKit = require("metalsmith-plugin-kit");
striptags = require("striptags");
unescape = require("unescape");

/**
 * The options for the plugin.
 *
 * @typedef {Object} options
 * @property {string} [destinationJson=search.json] The location of the final JSON document.
 * @property {string} [destinationJs=search.min.js] Where to add the associated JavaScript file.
 * @property {Object} [index={title:true,keywords:true,contents:"html"}] Fields to index for searching.
 * @property {module:metalsmith-plugin-kit~matchList} [match] Files to match, defaults to *.htm and *.html anywhere.
 * @property {module:metalsmith-plugin-kit~matchOptions} [matchOptions={}] Additional options for filename matching.
 * @property {boolean} [skipSearchJs=false] If true, do not add the JavaScript to the output files.
 * @property {boolean} [includeJson=false] If true, include JSON in call to showResults(...) in JavaScript.
 * @property {Function} [transformUrl] Callback for converting a single file into a URL. Input is the filename, the returned string is the URL.
 * @see {@link https://github.com/fidian/metalsmith-plugin-kit}
 */

/**
 * The Search factory.
 *
 * @example
 * var phoneticSearch = require("metalsmith-phonetic-search");
 *
 * // Make the metalsmith instance, then at the appropriate time, add this
 * // line.
 * metalsmith.use(phoneticSearch({
 *     // options go here
 * }));
 *
 * @param {module:metalsmith-phonetic-search~options} options
 * @return {Function} middleware
 */
module.exports = (options) => {
    var jsPath, searchData;

    options = pluginKit.defaultOptions({
        destinationJson: "index.json",
        destinationJs: "search.min.js",
        index: {
            title: true,
            keywords: true,
            contents: "html"
        },
        match: "**/*.{htm,html}",
        matchOptions: {},
        skipSearchJs: false,
        includeJson: false,
        transformUrl: (filename) => {
            return `/${filename}`;
        }
    }, options);

    // Convert the index definitions to functions.
    Object.keys(options.index).forEach((metadataName) => {
        var value;

        value = options.index[metadataName];

        if (!value || typeof value === "function") {
            return;
        }

        if (value === "html") {
            value = (str) => {
                return module.exports.makeKeywords(module.exports.stripHtml(str));
            };
        } else if (value === "markdown" || value === "md") {
            value = (str) => {
                return module.exports.makeKeywords(module.exports.stripMarkdown(str));
            };
        } else if (value === "keywords") {
            value = module.exports.makeKeywords;
        } else {
            // Truthy values mean to keep the value as-is.
            value = (str) => {
                return str;
            };
        }

        options.index[metadataName] = value;
    });

    jsPath = path.resolve(__dirname, "..", "asset", "search.js");

    return pluginKit.middleware({
        after: (files, metalsmith, done) => {
            if (options.includeJson) {
                fs.readFile(jsPath, (err, buffer) => {
                    if (!err) {
                        const data = "\n\n(function(){showResults(" + JSON.stringify(searchData) + ")})()";
                        pluginKit.addFile(files, options.destinationJs, buffer.toString("utf8") + data);
                    }
                    done(err);
                });
            } else {
                // Save search metadata to files object
                debug("Building JSON: %s", options.destinationJson);
                pluginKit.addFile(files, options.destinationJson, searchData);

                // Load JS and save on files object
                if (options.skipSearchJs) {
                    done();
                } else {
                    debug("Building JavaScript: %s", options.destinationJs);
                    fs.readFile(jsPath, (err, buffer) => {
                        if (!err) {
                            pluginKit.addFile(files, options.destinationJs, buffer);
                        }

                        done(err);
                    });
                }
            }
        },
        before: () => {
            searchData = {entries: [], index: {}};
        },
        each: (filename, file) => {
            debug("Processing: %s", filename);
            index(file, filename, options, searchData);
        },
        match: options.match,
        matchOptions: options.matchOptions,
        name: "metalsmith-phonetic-search"
    });
};


/**
 * Converts one big string into a space separated list of keywords.
 *
 * All keywords are converted to lowercase, are cleaned up a bit and
 * are deduplicated.
 *
 * @example
 * console.log(phoneticSearch.makeKeywords("One two THREE"));
 * // "one three two"
 *
 * @example
 * console.log(phoneticSearch.makeKeywords("Hi! ONE*two, pro- and ani- (whatever)"));
 * // "and anti hi one pro two whatever"
 *
 * @param {string} str
 * @return {string}
 */
module.exports.makeKeywords = (str) => {
    var map, words;

    // Add a space before and after the string so matching functions
    // can all use similar anchors.
    str = ` ${str} `;

    // Replace all newlines and whitespace with a single space. This speeds
    // up the later looping over each word.
    str = str.replace(/([ \n\r\t]|\s)+/g, " ");

    // Treat this punctuation as word separators
    str = str.replace(/[\\$!?|`.,;:()<>{}#*@/="[\]]/g, " ");

    // Change the content into a list of words by removing punctuation
    // from the left and right.
    str = str.replace(/ [-+_']+/g, " ");
    str = str.replace(/[-+_']+ /g, " ");

    // Change to lowercase to reduce the number of keywords due to their
    // capitalization.
    str = str.toLowerCase();

    // Change into a list of words. Use an object as a map.
    map = {};
    str.split(/ +/).forEach((word) => {
        if (word) {
            map[word] = true;
        }
    });
    words = Object.keys(map).sort();

    // Filter out non-words. This requires a letter or number in the string
    // in order to be kept.
    words = words.filter((word) => {
        return word.match(/[a-z0-9]/);
    });

    // Convert back to a single string.
    return words.join(" ");
};


/**
 * Remove HTML from some text. Adds a space wherever a tag was found.
 * Multiple spaces together are condensed into one and the resulting string
 * is also trimmed.
 *
 * @example
 * console.log(phoneticSearch.stripHtml("<p>Paragraph</p>");
 * // "Paragraph"
 *
 * @example
 * console.log(phoneticSearch.stripHtml("<div>This <i>is</i> <b>bold</b>.</div><div>hi</div>"));
 * // "This is bold . hi"
 *
 * @example
 * console.log(phoneticSearch.stripHtml("Arrow --&gt;"));
 * // "Arrow -->"
 *
 * @param {string} str
 * @return {string}
 */
module.exports.stripHtml = (str) => {
    str = striptags(str, null, " ");
    str = unescape(str);
    str = str.replace(/\s\s+/g, " ").trim();

    return str;
};


/**
 * Remove markdown from some text. This does not convert Markdown. Instead,
 * the goal is to only remove links from the text so the URLs don't get
 * indexed.
 *
 * @example
 * console.log(phoneticSearch.stripMarkdown("a [link](example.com)"));
 * // "a link"
 *
 * @example
 * console.log(phoneticSearch.stripMarkdown("[link]: example.com"));
 * // ""
 *
 * @param {string} str
 * @return {string}
 */
module.exports.stripMarkdown = (str) => {
    // Remove link definitions from markdown style text. These are where
    // a link is defined and is not embedded in text. Like this:
    // [link text]: http://example.com
    str = str.replace(/^\s*\[[^\]]*\]:.*$/gm, "");

    // Remove markdown links within text, but keep the link text.
    // blah blah [link](http://example.com) blah
    // blah blah [link][link reference] blah
    // blah blah [link] blah
    str = str.replace(/\[([^\]]*)\](\[[^\]]*\]|\([^)]*\))?/g, "$1");

    return str;
};
