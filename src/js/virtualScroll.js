/**
 * @fileoverview Virtual scroll component.
 * @author NHN Ent.
 *         FE Development Lab <dl_javascript@nhnent.com>
 */

'use strict';

var eventListener = require('./eventListener');

var DEFAULT_CONTENT_HEIGHT = 50;
var DEFAULT_SPARE_ITEM_COUNT = 5;
var DEFAULT_THRESHOLD = 300;
var DEFAULT_LAYOUT_HEIGHT = 400;
var PUBLIC_EVENT_MAP = {
    scroll: 'scroll',
    scrollTop: 'scrollTop',
    scrollBottom: 'scrollBottom'
};
var CSS_PX_PROP_MAP = {
    'height': true,
    'margin-top': true
};

var VirtualScroll = tui.util.defineClass(/** @lends VirtualScroll.prototype */{
    /**
     * Virtual scroll component.
     * @constructs VirtualScroll
     * @param {HTMLElement|String} container - container element or id
     * @param {object} options - virtual scroll component  options
     *      @param {?Array.<String>} options.items - items
     *      @param {?Number} options.spareItemCount - spare item count for calculating margin of wrapper area
     *      @param {?Number} options.defaultItemHeight - item height
     *      @param {?Number} options.layoutHeight - layout height
     *      @param {?Number} options.scrollPosition - scroll position
     */
    init: function(container, options) {
        options = options || {};
        options.scrollPosition = options.scrollPosition || 0;

        /**
         * last rendered scroll position
         * @type {Number}
         */
        this.lastRenderedScrollPosition = options.scrollPosition;

        /**
         * previous scroll position
         * @type {?Number}
         */
        this.prevScrollPosition = options.scrollPosition;

        /**
         * the state being a public event occurs
         * @type {boolean}
         */
        this.publicEventMode = false;

        this._initData(options);

        /**
         * container element
         * @type {HTMLElement}
         */
        this.container = tui.util.isString(container) ? document.getElementById(container) : container;

        /**
         * layout element
         * @type {HTMLElement}
         */
        this.layout = this._renderLayout(this.container);

        this._renderContents(options.scrollPosition);
        this._attachEvent();
    },

    /**
     * Whether plus number or not.
     * @param {Number} value - value
     * @returns {boolean}
     * @private
     */
    _isPlusNumber: function(value) {
        return tui.util.isNumber(value) && !isNaN(value) && (value > 0);
    },

    /**
     * Initialize data.
     * @param {object} options - virtual scroll component options
     *      @param {?Array.<String>} options.items - items
     *      @param {?Number} options.spareItemCount - spare item count for rendering margin of wrapper area
     *      @param {?Number} options.defaultItemHeight - item height
     *      @param {?Number} options.layoutHeight - layout height
     *      @param {?Number} options.scrollPosition - scroll position
     * @private
     */
    _initData: function(options) {
        var spareItemCount = options.spareItemCount;
        var defaultItemHeight = options.defaultItemHeight;
        var layoutHeight = options.layoutHeight;
        var threshold = options.threshold;

        /**
         * items for rendering contents.
         * @type {Array.<{height: Number, contents: String}>}
         */
        this.items = [];
        this._insertItems(options.items || [], 0);

        /**
         * item height list.
         * @type {Array.<Number>}
         */
        this.itemHeights = tui.util.pluck(this.items, 'height');

        /**
         * item height for rendering item.
         * @type {Number}
         */
        this.defaultItemHeight = this._isPlusNumber(defaultItemHeight) ? defaultItemHeight : DEFAULT_CONTENT_HEIGHT;

        /**
         * spare item count for rendering margin of wrapper area
         * @type {Number}
         */
        this.spareItemCount = this._isPlusNumber(spareItemCount) ? spareItemCount : DEFAULT_SPARE_ITEM_COUNT;

        /**
         * size for checking to reach the terminal, when scroll event
         * @type {number}
         */
        this.threshold = this._isPlusNumber(threshold) ? threshold : DEFAULT_THRESHOLD;

        /**
         * layout height for rendering layout
         * @type {Number}
         */
        this.layoutHeight = this._isPlusNumber(layoutHeight) ? layoutHeight : DEFAULT_LAYOUT_HEIGHT;

        /**
         * limit scroll value for rerender
         * @type {number}
         */
        this.limitScrollValueForRerender = (this.spareItemCount / 2 * this.defaultItemHeight);
    },

    /**
     * Create cssText.
     * @param {Object.<String, Number>} cssMap - css map
     * @returns {String}
     * @private
     */
    _createCssText: function(cssMap) {
        return tui.util.map(cssMap, function(value, property) {
            var surffix = CSS_PX_PROP_MAP[property] ? 'px' : '';

            return property + ':' + value + surffix;
        }).join(';');
    },

    /**
     * Create div html.
     * @param {Object.<String, String>} attrMap - attribute map
     * @param {String} innerHtml - html string
     * @returns {String}
     * @private
     */
    _createDivHtml: function(attrMap, innerHtml) {
        var attrString = tui.util.map(attrMap, function(value, property) {
            return property + '="' + value + '"';
        }).join(' ');

        return '<div ' + attrString + '>' + innerHtml + '</div>';
    },

    /**
     * Render layout.
     * @param {HTMLElement} container - container element
     * @returns {HTMLElement}
     * @private
     */
    _renderLayout: function(container) {
        var cssText;

        if (!container) {
            throw new Error('Not exist HTML container');
        }

        if (!tui.util.isHTMLTag(container)) {
            throw new Error('This container is not a HTML element');
        }

        cssText = this._createCssText({
            'width': '100%',
            'height': this.layoutHeight,
            'overflow-y': 'auto',
            '-webkit-overflow-scrolling': 'touch'
        });

        container.innerHTML = this._createDivHtml({
            'style': cssText
        });

        return container.firstChild;
    },

    /**
     * Make item position list.
     * @param {Number} itemHeights - item heights
     * @returns {Array}
     * @private
     */
    _makeItemPositionList: function(itemHeights) {
        var startPosition = 0;

        return tui.util.map(itemHeights, function(itemHeight) {
            var itemPosition = {
                start: startPosition,
                end: startPosition + (itemHeight || this.defaultItemHeight)
            };

            startPosition = itemPosition.end;

            return itemPosition;
        }, this);
    },

    /**
     * Find actual start index in itemPositionList by scrollPosition.
     * @param {Array.<{start: number, end: number}>} itemPositionList - item position list
     * @param {Number} scrollPosition - scroll position
     * @returns {Number | null}
     * @private
     */
    _findActualStartIndex: function(itemPositionList, scrollPosition) {
        var foundIndex = null;

        scrollPosition = scrollPosition || 0;
        tui.util.forEachArray(itemPositionList, function(itemPosition, index) {
            if (itemPosition.start <= scrollPosition && itemPosition.end > scrollPosition) {
                foundIndex = index;
            }

            return tui.util.isEmpty(foundIndex);
        });

        if (itemPositionList.length && tui.util.isNull(foundIndex)) {
            foundIndex = itemPositionList.length - 1;
        }

        return foundIndex;
    },

    /**
     * Calculate display count.
     * @param {Array.<Number>} displayItemHeights - item height list for display;
     * @returns {number}
     * @private
     */
    _calculateDisplayCount: function(displayItemHeights) {
        var layoutHeight = this.layoutHeight;
        var cumulativeHeight = 0;
        var displayCount = 0;

        tui.util.forEachArray(displayItemHeights, function(height) {
            cumulativeHeight += height;
            displayCount += 1;

            return cumulativeHeight < layoutHeight;
        });

        return displayCount;
    },

    /**
     * Update index range.
     * @param {Number} scrollPosition - scrollPosition for scroll
     * @returns {{start: Number, end: Number}}
     * @private
     */
    _createIndexRange: function(scrollPosition) {
        var itemHeights = this.itemHeights;
        var maximumEndIndex = itemHeights.length;
        var spareItemCount = this.spareItemCount;
        var itemPositionList = this._makeItemPositionList(itemHeights);
        var actualStartIndex = this._findActualStartIndex(itemPositionList, scrollPosition);
        var displayCount = this._calculateDisplayCount(itemHeights.slice(actualStartIndex));
        var startIndex = Math.max(actualStartIndex - spareItemCount, 0);
        var endIndex = Math.min(actualStartIndex + displayCount + spareItemCount, maximumEndIndex);

        return {
            start: startIndex,
            end: endIndex
        };
    },

    /**
     * Create items html.
     * @param {Number} startIndex - start index
     * @param {Number} endIndex - end index
     * @returns {String}
     * @private
     */
    _createItemsHtml: function(startIndex, endIndex) {
        var renderItems = this.items.slice(startIndex, endIndex);
        var baseCssTextMap = {
            'width': '100%',
            'overflow-y': 'hidden'
        };

        return tui.util.map(renderItems, function(item) {
            baseCssTextMap.height = item.height || this.defaultItemHeight;

            return this._createDivHtml({
                'style': this._createCssText(baseCssTextMap)
            }, item.contents);
        }, this).join('');
    },

    /**
     * Sum values.
     * @param {Array.<Number>} values - values
     * @returns {number}
     * @private
     */
    _sum: function(values) {
        var copyValues = values.slice();

        copyValues.unshift(0);
        return tui.util.reduce(copyValues, function(base, add) {
            return base + add;
        });
    },

    /**
     * Create cssText for item wrapper element.
     * @param {Number} startIndex - start index
     * @returns {String}
     * @private
     */
    _createItemWrapperCssText: function(startIndex) {
        var itemHeights = this.itemHeights;
        var marginTop = this._sum(itemHeights.slice(0, startIndex));
        var height = this._sum(itemHeights) - marginTop;

        return this._createCssText({
            'width': '100%',
            'height': height,
            'margin-top': marginTop,
            'overflow-y': 'hidden'
        });
    },

    /**
     * Create html for item wrapper element
     * @param {Number} scrollPosition - scroll position
     * @returns {String}
     * @private
     */
    _createItemWrapperHtml: function(scrollPosition) {
        var indexRange = this._createIndexRange(scrollPosition);
        var innerHtml = this._createItemsHtml(indexRange.start, indexRange.end);
        var cssText = this._createItemWrapperCssText(indexRange.start);

        return this._createDivHtml({'style': cssText}, innerHtml);
    },

    /**
     * Render contents.
     * @param {?Number} scrollPosition - scroll position
     * @private
     */
    _renderContents: function(scrollPosition) {
        var layout = this.layout;

        layout.innerHTML = this._createItemWrapperHtml(scrollPosition || Math.max(this.layout.scrollTop, 0));

        if (!tui.util.isExisty(scrollPosition)) {
            return;
        }

        setTimeout(function() {
            layout.scrollTop = scrollPosition;
        });
    },

    /**
     * Fire public event.
     * @param {String} eventName - event name
     * @param {{scrollPosition: Number, scrollHeight: number}} eventData - event data
     * @private
     */
    _firePublicEvent: function(eventName, eventData) {
        if (this.publicEventMode) {
            return;
        }

        this.fire(eventName, eventData);
        this.publicEventMode = true;
    },

    /**
     * Handler for scroll event.
     * @private
     */
    _onScroll: function() {
        var scrollPosition = Math.max(this.layout.scrollTop, 0);
        var scrollHeight = this.layout.scrollHeight - this.layout.offsetHeight;
        var eventData = {
            scrollPosition: scrollPosition,
            scrollHeight: scrollHeight
        };

        this.fire(PUBLIC_EVENT_MAP.scroll, tui.util.extend({
            movedPosition: this.prevScrollPosition - scrollPosition
        }, eventData));

        this.prevScrollPosition = scrollPosition;

        if (scrollPosition >= (scrollHeight - this.threshold)) {
            this._firePublicEvent(PUBLIC_EVENT_MAP.scrollBottom, eventData);
        } else if (scrollPosition <= this.threshold) {
            this._firePublicEvent(PUBLIC_EVENT_MAP.scrollTop, eventData);
        } else {
            this.publicEventMode = false;
        }

        if (Math.abs(this.lastRenderedScrollPosition - scrollPosition) < this.limitScrollValueForRerender) {
            return;
        }

        this.lastRenderedScrollPosition = scrollPosition;

        this._renderContents();
    },

    /**
     * Attach event.
     * @private
     */
    _attachEvent: function() {
        eventListener.on(this.layout, 'scroll', this._onScroll, this);
    },

    /**
     * Collect items.
     * @param {Array.<Object | String>} items - items
     * @returns {Array.<{height: number, contents: String}>}
     * @private
     */
    _correctItems: function(items) {
        var correctedItems = [];

        tui.util.forEachArray(items, function(item) {
            if (tui.util.isObject(item)) {
                item.height = tui.util.isNumber(item.height) ? item.height : this.defaultItemHeight;
                correctedItems.push(item);
            } else if (tui.util.isExisty(item)) {
                correctedItems.push({
                    height: this.defaultItemHeight,
                    contents: String(item)
                });
            }
        }, this);

        return correctedItems;
    },

    /**
     * Insert items.
     * @param {Array.<Object | String>} items - items
     * @param {?Number} startIndex - start index for append
     * @private
     */
    _insertItems: function(items, startIndex) {
        items = this._correctItems(items);
        this.items.splice.apply(this.items, [startIndex, 0].concat(items));
    },

    /**
     * Append items.
     * @param {Array.<{height: ?Number, contents: String}>} items - items
     * @api
     */
    append: function(items) {
        this._insertItems(items, this.items.length);
        this.itemHeights = tui.util.pluck(this.items, 'height');
        this._renderContents();
    },

    /**
     * Prepend items.
     * @param {Array.<{height: ?Number, contents: String}>} items - items
     * @api
     */
    prepend: function(items) {
        var scrollPosition = this.layout.scrollTop + this._sum(tui.util.pluck(items, 'height'));

        this._insertItems(items, 0);
        this.itemHeights = tui.util.pluck(this.items, 'height');
        this._renderContents(scrollPosition);
    },

    /**
     * Insert items.
     * @param {Array.<{height: ?Number, contents: String}>} items - items
     * @param {number} index - index
     * @api
     */
    insert: function(items, index) {
        var lastIndex = this.items.length - 1;

        index = Math.max(Math.min(index, lastIndex), 0);
        this._insertItems(items, index);
        this.itemHeights = tui.util.pluck(this.items, 'height');
        this._renderContents();
    },

    /**
     * Remove item.
     * @param {number} index - index
     * @returns {?{height: Number, contents: String}}
     * @private
     */
    _removeItem: function(index) {
        var removedItem;

        index = parseInt(index, 10);

        if (isNaN(index)) {
            throw new Error('index should be a number');
        }

        removedItem = this.items.splice(index, 1);
        this.itemHeights.splice(index, 1);

        return removedItem[0];
    },

    /**
     * Remove items.
     * @param {Array.<Number>} removeItemIndexList - list of item index for remove
     * @returns {Array.<?{height: Number, contents: String}>}
     * @private
     */
    _removeItems: function(removeItemIndexList) {
        var newItems = [];
        var removedItems = [];

        if (tui.util.isArray(removeItemIndexList)) {
            tui.util.forEachArray(this.items, function(item, index) {
                if (tui.util.inArray(index, removeItemIndexList) === -1) {
                    newItems.push(item);
                } else {
                    removedItems.push(item);
                }
            }, this);

            this.items = newItems;
            this.itemHeights = tui.util.pluck(newItems, 'height');
        }

        return removedItems;
    },

    /**
     * Remove item or items.
     * @param {Array.<Number> | Number} index - remove item index or index list
     * @param {boolean} isRerendering - whether rerendering or not
     * @returns {Array.<{height: Number, contents: String}> | {height: Number, contents: String}}
     * @api
     */
    remove: function(index, isRerendering) {
        var removed;

        if (tui.util.isArray(index)) {
            removed = this._removeItems(index);
        } else {
            removed = this._removeItem(index);
        }

        isRerendering = !tui.util.isBoolean(isRerendering) ? true : isRerendering;

        if (isRerendering && removed && (!tui.util.isArray(removed) || removed.length)) {
            this._renderContents();
        }

        return removed;
    },

    /**
     * Clear items.
     * @api
     */
    clear: function() {
        this.items = [];
        this.itemHeights = [];
        this.layout.innerHTML = '';
    },

    /**
     * Move scroll.
     * @param {Number} scrollPosition - scroll position
     * @api
     */
    moveScroll: function(scrollPosition) {
        scrollPosition = parseInt(scrollPosition, 10);

        if (!this._isPlusNumber(scrollPosition)) {
            throw new Error('The scroll position value should be a plus number');
        }

        this._renderContents(scrollPosition);
    },

    /**
     * Resize height.
     * @param {Number} height - layout height
     * @api
     */
    resizeHeight: function(height) {
        var prevScrollTop;

        height = parseInt(height, 10);

        if (!this._isPlusNumber(height)) {
            throw new Error('The height value should be a plus number');
        }

        prevScrollTop = this.layout.scrollTop;

        this.layoutHeight = height;
        this.layout.style.height = height + 'px';
        this._renderContents(prevScrollTop);
    },

    /**
     * Get items.
     * @returns {Array.<String>}
     * @api
     */
    getItems: function() {
        return this.items.slice();
    },

    /**
     * Get item count.
     * @returns {Number}
     * @api
     */
    getItemCount: function() {
        return this.items.length;
    },

    /**
     * Get scroll position value.
     * @returns {Number}
     * @api
     */
    getScrollPosition: function() {
        return this.layout.scrollTop;
    },

    /**
     * Destroy.
     * @api
     */
    destroy: function() {
        eventListener.off(this.layout, 'scroll', this._onScroll, this);
        this.container.innerHTML = '';
        this.container = null;
    }
});

tui.util.CustomEvents.mixin(VirtualScroll);

/**
 * NHN Entertainment Toast UI Chart.
 * @namespace tui.chart
 */
tui.util.defineNamespace('tui.component');
tui.component.VirtualScroll = VirtualScroll;
