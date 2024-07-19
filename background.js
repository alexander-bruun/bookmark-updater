chrome.action.onClicked.addListener(async function (tab) {
    console.time('New Script Execution Time');
    const bookmarkTreeNodes = await getBookmarkTree();
    await updateBookmarkFromTab(tab, bookmarkTreeNodes);
    console.timeEnd('New Script Execution Time');
});

async function getBookmarkTree() {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree(resolve);
    });
}

async function searchBookmarks(query) {
    return new Promise((resolve) => {
        chrome.bookmarks.search(query, resolve);
    });
}

async function createBookmark(details) {
    return new Promise((resolve) => {
        chrome.bookmarks.create(details, resolve);
    });
}

async function updateBookmark(id, changes) {
    return new Promise((resolve) => {
        chrome.bookmarks.update(id, changes, resolve);
    });
}

async function updateBookmarkFromTab(tab, bookmarkTreeNodes) {
    console.time('Bookmark Traversal Time');

    let highestScore = 0.0;
    let bestMatchBookmark = null;
    let bestMatchId = null;

    // Helper function to traverse nodes
    const traverseNodes = (nodes) => {
        for (const node of nodes) {
            const nodeUrl = node.url;
            if (nodeUrl) {
                const similarityScore = compareUrls(tab.url, nodeUrl);
                if (similarityScore > highestScore) {
                    highestScore = similarityScore;
                    bestMatchBookmark = node;
                    bestMatchId = node.id;
                    if (highestScore >= 0.9) return; // Early exit if high similarity is found
                }
            }
            const children = node.children;
            if (children) {
                traverseNodes(children);
                if (highestScore >= 0.9) return; // Early exit if high similarity is found
            }
        }
    };

    traverseNodes(bookmarkTreeNodes);

    if (bestMatchBookmark && bestMatchBookmark.url !== tab.url) {
        if (highestScore >= 0.9) {
            await updateBookmark(bestMatchId, { title: tab.title, url: tab.url });
            console.log("Overwriting existing bookmark.");
        } else {
            await createNewBookmark(tab);
        }
    } else {
        console.log("Skipping update since the open tab is identical to the saved bookmark.");
    }

    console.timeEnd('Bookmark Traversal Time');
}

async function createNewBookmark(tab) {
    const bookmarkFolderName = "Bookmark Updater";
    const searchResults = await searchBookmarks({ title: bookmarkFolderName });

    if (searchResults.length > 0) {
        await createBookmark({ parentId: searchResults[0].id, title: tab.title, url: tab.url });
        console.log("Creating a new bookmark.");
    } else {
        const newFolder = await createBookmark({ title: bookmarkFolderName });
        console.log("Added folder: " + newFolder.title);
        await createBookmark({ parentId: newFolder.id, title: tab.title, url: tab.url });
        console.log("Created new bookmark in the folder with id: " + newFolder.id);
    }
}

function compareUrls(firstUrl, secondUrl) {
    if (firstUrl === secondUrl) return 1;

    const len1 = firstUrl.length;
    const len2 = secondUrl.length;
    if (len1 < 2 || len2 < 2) return 0;

    const bigramCounts = {};
    let commonBigramsCount = 0;
    let totalBigrams = 0;

    // Process the first URL
    for (let i = 0; i < len1 - 1; i++) {
        const bigram = firstUrl.substring(i, i + 2);
        bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
    }

    // Process the second URL and calculate common bigrams
    for (let i = 0; i < len2 - 1; i++) {
        const bigram = secondUrl.substring(i, i + 2);
        if (bigramCounts[bigram]) {
            commonBigramsCount++;
            bigramCounts[bigram]--;
        }
        totalBigrams++;
    }

    // Include remaining bigrams from the first URL
    totalBigrams += len1 - 1;

    return (2.0 * commonBigramsCount) / totalBigrams;
}

