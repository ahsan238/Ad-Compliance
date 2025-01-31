// Inject this script into the head of the browser page
let scriptID = 'SCRIPTID_ARBITRARY';
let DEPTHLIMIT = 50;

// const roundToTwo = num => +(Math.round(num + "e+2") + "e-2");
// const windowArea = parseFloat(window.innerHeight * window.innerWidth)
window.addEventListener("load", function() {
    // debugger;
    this.setTimeout(function() {
        console.log('load!')
        // Wait for the DOM content to be fully loaded
    
        // Extract XPaths of all elements
        const elements = [];
        const rootNode = document.documentElement;
        let depth = 0; // For some of the websites, the depth can be in the order of 1000 so we need to stop the recursion at some point
    
        function dfs(node,depth=0) {
            // skip the node if it is a text node
            if (node.nodeType === Node.TEXT_NODE) {
                return;
            }
            if (depth > DEPTHLIMIT) {
                console.log('Depth limit reached. Stopping recursion.');
                return;
            } else {
                console.log('Depth:', depth);
            }
            // only push element details if image or video
            let allowedContent = ['IMG', 'VIDEO', 'svg', 'SPAN', 'CANVAS']
            if (true || allowedContent.includes(node.tagName)) {
                // first check if the potential ad is a violation
                let violations = {
                    oversizedImage: checkForOversizedImageAds(node),
                    autoplayMedia: checkForAutoplayMedia(node),
                    overlayAds: checkForOverlayAds(node),
                    interstitialAds: isInterstitialAd(node),
                    popupAds: checkForPopupAds(node),
                    popunderAds: checkForPopunderAds(node)
                }
                let metadata = {
                    xpath: Elements.DOMPath.xPath(node, false),
                    optimizedXpath: Elements.DOMPath.xPath(node, true),
                    src: node.src || node.href ||  '',
                    id: node.id || '',
                    className: node.className || '',
                    rootElementXpath: Elements.DOMPath.xPath(node.ownerDocument.documentElement, true) || '',
                    parentXpath: Elements.DOMPath.xPath(node.parentNode, true) || '',
                    externalProperties: checkOuterHTML(node),
                    // iframe: checkiFrame(node),
                }
                let properties = {
                    height: node.clientHeight || node.height || '',
                    width: node.clientWidth || node.width || '',
                    tagName: node.tagName || '',
                    innerHTML: node.innerHTML || '',
                }
                // combine the properties, violations and metadata
                
                elements.push(Object.assign({}, metadata, violations));
            }
            // if the current node is an iframe, then we need to run dfs on the iframe's contentWindow
            // but this does not work for cross-origin frames
            if (node.tagName === 'IFRAME') {
                try {
                    const iframeDocument = node.contentWindow.document;
                    dfs(iframeDocument.documentElement);
                } catch (e) {
                    console.log('Error while trying to access iframe contentWindow:', e);
                }
            }
            for (const childNode of node.childNodes || []) {
                dfs(childNode, depth+1);
            }
        }
    
        dfs(rootNode);
        // console.log(scriptID,elements);
        sendElemXpathsToBackground(elements);
        // Save XPaths in an array
        // console.log(elements);

    }, 10000)
});

function checkiFrame(node) {
    try{
        if (node.tagName === 'IFRAME') {
            // return the innterHtml or node.textContent of the iframe
            return node.outerHTML || node.textContent || node.innerHTML || '';
        }
    } catch (e) {
        console.log('Error in checkiFrame:', e);
        return '';
    }
}

function checkOuterHTML(node) {
    // first check the tagName. Only return the outerHTML if the tagName is  iFrame or IMG
    try{
        if (node.tagName === 'IFRAME' || node.tagName === 'IMG') {
            // create an object that has the following keys: outerHTML, layoutArea, screenValue
            return {
                outerHTML: node.outerHTML || '',
                height: node.offsetHeight || -1,
                width: node.offsetWidth || -1,
                layoutArea: node.offsetHeight * node.offsetWidth || -1,
                screenValue: (node.offsetHeight * node.offsetWidth) / (window.innerHeight * window.innerWidth) || -1,
                windowArea: (window.innerHeight * window.innerWidth)
            }
            // return node.outerHTML || '';
        }
    } catch (e) {
        console.log('Error in checkOuterHTML:', e);
        return {};
    }
}

function sendElemXpathsToBackground(elements) {
    // Send the array of XPaths to the background proxy script
    console.log('length of elements: ', elements.length)
    var url = "https://whatisthis.com/non-exist-api/" + scriptID;
    let combinedObj = Object.assign({}, elements, {scriptID: scriptID});
    var option = {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(combinedObj),
        mode: 'no-cors',
      };
      fetch(url, option).then(function (res) {
        return res.text();
      }).then(function (text) {
        if (text !== "ACK") console.log("Fail to send log to ".concat(url, " due to ACK not received, but receive ").concat(text));
        // resolve();
        console.log(text)
      }).catch(function (e) {
        return console.log("Fail to send log to ".concat(url, " due to ").concat(e.message));
      });
}


function checkForOversizedImageAds(node) {
    try{
        if (node.clientWidth > window.innerWidth * 0.8 || node.clientHeight > window.innerHeight * 0.8) {
            return 1;
        }
        return 0;
    } catch (e) {
        console.log('Error in checkForOversizedImageAds:', e);
        return 0;
    }
}

function checkForAutoplayMedia(node) {
    try{
        if (node.autoplay || node.preload === 'auto') {
            return 1;
        }
        return 0;
    } catch (e) {
        console.log('Error in checkForAutoplayMedia:', e);
        return 0;
    }
}

function checkForOverlayAds(node) {
    // severely inaccurate - all the items that are uncommon across two settings may fall under this. this is why we are seeing a higher count for this kind of ads
    try{
        if (getComputedStyle(node).position === 'fixed' || getComputedStyle(node).position === 'absolute') {
            return 1;
        }
        return 0;
    } catch (e) {
        console.log('Error in checkForOverlayAds:', e);
        return 0;
    }
}

function checkForPopupAds(node) {
    try{
        let fullAtr = getComputedStyle(node);
        // check if z-index is high
    
        if ((fullAtr.position === 'fixed' || fullAtr.position === 'absolute') && fullAtr.zIndex != 'auto' && fullAtr.zIndex > 0) {
            return 1;
        }
        return 0;
    }
    catch (e) {
        console.log('Error in checkForPopupAds:', e);
        return 0;
    }
}

function checkForPopunderAds(node) {
    try{
        let fullAtr = getComputedStyle(node);
        // check if z-index is high
    
        if ((fullAtr.position === 'fixed' || fullAtr.position === 'absolute') && fullAtr.zIndex != 'auto' && fullAtr.zIndex < 0) {
            return 1;
        }
        return 0;
    } catch (e) {
        console.log('Error in checkForPopunderAds:', e);
        return 0;
    }
}

function isInterstitialAd(element) {
    try {
        // Check if the element is large enough to be considered interstitial
        // For example, covering most of the viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const threshold = 0.75; // 75% of the viewport

        const elementRect = element.getBoundingClientRect();
        const isLargeEnough = elementRect.width / viewportWidth > threshold && elementRect.height / viewportHeight > threshold;

        // Check if the element is positioned in a way typical for interstitial ads
        const isPositionedCorrectly = (elementRect.top <= 0 && elementRect.left <= 0);

        // Check display style - interstitial ads are often set to 'fixed' or 'absolute'
        const style = window.getComputedStyle(element);
        const isFixedOrAbsolute = style.position === 'fixed' || style.position === 'absolute';

        // Additional checks can be added here (e.g., specific class names, IDs, or other attributes)

        if (isLargeEnough && isPositionedCorrectly && isFixedOrAbsolute) {
            return 1;
        }
        return 0;
    }
    catch (e) {
        console.log('Error in isInterstitialAd:', e);
        return 0;
    }
}



// XPATH CODE FROM CHROMIUM https://stackoverflow.com/questions/2661818/javascript-get-xpath-of-a-node
// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

Elements = {};
Elements.DOMPath = {};

/**
 * @param {!Node} node
 * @param {boolean=} optimized
 * @return {string}
 */
Elements.DOMPath.xPath = function (node, optimized) {
    if (node.nodeType === Node.DOCUMENT_NODE) {
        return '/';
    }

    const steps = [];
    let contextNode = node;
    while (contextNode) {
        const step = Elements.DOMPath._xPathValue(contextNode, optimized);
        if (!step) {
            break;
        }  // Error - bail out early.
        steps.push(step);
        if (step.optimized) {
            break;
        }
        contextNode = contextNode.parentNode;
    }

    steps.reverse();
    return (steps.length && steps[0].optimized ? '' : '/') + steps.join('/');
};

/**
 * @param {!Node} node
 * @param {boolean=} optimized
 * @return {?Elements.DOMPath.Step}
 */
Elements.DOMPath._xPathValue = function (node, optimized) {
    let ownValue;
    const ownIndex = Elements.DOMPath._xPathIndex(node);
    if (ownIndex === -1) {
        return null;
    }  // Error.

    switch (node.nodeType) {
        case Node.ELEMENT_NODE:
            if (optimized && node.getAttribute('id')) {
                return new Elements.DOMPath.Step('//*[@id="' + node.getAttribute('id') + '"]', true);
            }
            ownValue = node.localName;
            break;
        case Node.ATTRIBUTE_NODE:
            ownValue = '@' + node.nodeName;
            break;
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
            ownValue = 'text()';
            break;
        case Node.PROCESSING_INSTRUCTION_NODE:
            ownValue = 'processing-instruction()';
            break;
        case Node.COMMENT_NODE:
            ownValue = 'comment()';
            break;
        case Node.DOCUMENT_NODE:
            ownValue = '';
            break;
        default:
            ownValue = '';
            break;
    }

    if (ownIndex > 0) {
        ownValue += '[' + ownIndex + ']';
    }

    return new Elements.DOMPath.Step(ownValue, node.nodeType === Node.DOCUMENT_NODE);
};

/**
 * @param {!Node} node
 * @return {number}
 */
Elements.DOMPath._xPathIndex = function (node) {
    // Returns -1 in case of error, 0 if no siblings matching the same expression,
    // <XPath index among the same expression-matching sibling nodes> otherwise.
    function areNodesSimilar(left, right) {
        if (left === right) {
            return true;
        }

        if (left.nodeType === Node.ELEMENT_NODE && right.nodeType === Node.ELEMENT_NODE) {
            return left.localName === right.localName;
        }

        if (left.nodeType === right.nodeType) {
            return true;
        }

        // XPath treats CDATA as text nodes.
        const leftType = left.nodeType === Node.CDATA_SECTION_NODE ? Node.TEXT_NODE : left.nodeType;
        const rightType = right.nodeType === Node.CDATA_SECTION_NODE ? Node.TEXT_NODE : right.nodeType;
        return leftType === rightType;
    }

    const siblings = node.parentNode ? node.parentNode.children : null;
    if (!siblings) {
        return 0;
    }  // Root node - no siblings.
    let hasSameNamedElements;
    for (let i = 0; i < siblings.length; ++i) {
        if (areNodesSimilar(node, siblings[i]) && siblings[i] !== node) {
            hasSameNamedElements = true;
            break;
        }
    }
    if (!hasSameNamedElements) {
        return 0;
    }
    let ownIndex = 1;  // XPath indices start with 1.
    for (let i = 0; i < siblings.length; ++i) {
        if (areNodesSimilar(node, siblings[i])) {
            if (siblings[i] === node) {
                return ownIndex;
            }
            ++ownIndex;
        }
    }
    return -1;  // An error occurred: |node| not found in parent's children.
};

/**
 * @unrestricted
 */
Elements.DOMPath.Step = class {
    /**
     * @param {string} value
     * @param {boolean} optimized
     */
    constructor(value, optimized) {
        this.value = value;
        this.optimized = optimized || false;
    }

    /**
     * @override
     * @return {string}
     */
    toString() {
        return this.value;
    }
};

