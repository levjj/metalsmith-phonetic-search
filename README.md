Metalsmith Phonetic Search
==========================

Include a client-side site search based on a static index for the contents of your website.
This is based of [metalsmith-simple-search](https://github.com/connected-world-services/metalsmith-simple-search) but uses phonetic matching.


Installation
------------

This is still in early development and not released on npm yet. However, you can clone this GitHub repository and use it at your own risk.


Usage
-----

Metadata properties are copied to the resulting JSON objects, optionally passing through filters.  First, this is an example that shows the default options in the JSON format. You do not need to specify any of these unless you want to override the default.

    {
        "plugins": {
            "metalsmith-phonetic-search": {
                "destinationJs": "search.min.js",
                "destinationJson": "index.json",
                "index": {
                    "title": true,
                    "keywords": true,
                    "contents": "html"
                },
                "match": "**/*.{htm,html}",
                "matchOptions": {},
                "skipSearchJs": false
            }
        }
    }

This is how you would use it in JavaScript. Again, these are the defaults and don't need to be specified unless you want to override what they do.

    // Load the plugin
    var phoneticSearch = require("metalsmith-phonetic-search");

    // Use this in your list of plugins.
    .use(phoneticSearch())

    // Alternately, you can specify options. The values shown here are the
    // defaults and can be overridden.
    use(phoneticSearch({
        // Where to save the JavaScript client code that performs the searches
        // in the browser. Disable with the `skipSearchJs` setting.
        destinationJs: "search.min.js",

        // Where to save the resulting JSON file that contains search index.
        destinationJson: "index.json",

        // Metadata fields to index and how to index them. A lengthier
        // description follows after the example.
        index: {
            title: true,
            keywords: true,
            contents: "html"
        },

        // Pattern of files to match so only some files are placed into the
        // search index.
        match: "**/*.{htm,html}",

        // Options for matching files. See metalsmith-plugin-kit.
        matchOptions: {},

        // If true, do not write the `destinationJs` to the output files.
        // When switching this on, make sure the "search.min.js" file
        // is somehow included in your build.
        skipSearchJs: false,

        // Transform the filename into a URL for the search engine. The
        // result from this file is saved as the ".url" property in the
        // per-file search object.
        transformUrl: function (filename) {
            return "/" + filename;
        }
    }));

This uses [`metalsmith-plugin-kit`](https://github.com/fidian/metalsmith-plugin-kit) for matching files. It documents the options that can be used to control how files are matched.

The `index` property will determine how a particular file's metadata is indexed. It can be set to one of several values.

* `false` or `null` - Do not index this property. Great for overriding defaults.
* `true` - Index this property. If the value is an object, call `.toString()` on it first. If the value is an array, join with `" "`. Once it is a text string, index this as-is.
* `"html"` - Convert the value to a string then remove all HTML tags and unescape any escaped content. This means `<div class="xyz">text</div>` turns into `text` (HTML elements removed). The HTML is scanned for changed to lowercase, made into a list of keywords and duplicates are removed.
* `"markdown"` or `"md"` - Assume the value is markdown and remove some non-text markup. The markdown is changed to lowercase, made into a list of keywords and duplicates are removed.
* `"keywords"` - Change the text into lowercase, make it into a list of keywords and remove duplicates.
* `outStr = function (inStr)` - A custom function of your own that will take the string value of this metadata and convert it into a cleansed version.

In order to load the index and perform the search, you will need to use the `search.js`/`search.min.js` JavaScript file in the browser. These files are included in this repository but may need to be configured.

Full API
--------

See [metalsmith-simple-search](https://github.com/connected-world-services/metalsmith-simple-search).

This plugin is licensed under the [MIT License][LICENSE.md] with additional clauses. See the [full license text][LICENSE.md] for information.
