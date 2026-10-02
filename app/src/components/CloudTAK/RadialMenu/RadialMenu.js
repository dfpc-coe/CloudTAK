'use strict';

const DEFAULT_SIZE = 100;
const MIN_SECTORS  = 3;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export default function RadialMenu(params) {
    this.parent  = params.parent  || [];

    this.size      = params.size    || DEFAULT_SIZE;
    this.onClick   = params.onClick || null;
    this.onClose   = params.onClose || null;
    this.menuItems = params.menuItems ? params.menuItems : [{id: 'one', title: 'One'}, {id: 'two', title: 'Two'}];

    this.radius      = 50;
    this.innerRadius = this.radius * 0.4;
    this.sectorSpace = this.radius * 0.06;
    this.sectorCount = Math.max(this.menuItems.length, MIN_SECTORS);
    this.closeOnClick = params.closeOnClick !== undefined ? !!params.closeOnClick : false;

    this.scale       = 1;
    this.holder      = null;
    this.parentMenu  = [];
    this.parentItems = [];
    this.levelItems  = null;

    this.createHolder();
    this.addIconSymbols();

    this.currentMenu = null;

    this.onMouseWheelHandler = (event) => {
        this.onMouseWheel(event);
    }
    this.onKeyDownHandler = (event) => {
        this.onMouseWheel(event);
    }

    document.addEventListener('wheel', this.onMouseWheelHandler);
    document.addEventListener('keydown', this.onKeyDownHandler);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.open = function () {
    if (!this.currentMenu) {
        this.currentMenu = this.createMenu('menu inner', this.menuItems);
        this.holder.appendChild(this.currentMenu);

        // wait DOM commands to apply and then set class to allow transition to take effect
        RadialMenu.nextTick(() => {
            this.currentMenu.setAttribute('class', 'menu');
        });
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.close = function () {
    document.removeEventListener('wheel', this.onMouseWheelHandler);
    document.removeEventListener('keydown', this.onKeyDownHandler);

    if (this.currentMenu) {
        var parentMenu;
        // eslint-disable-next-line no-cond-assign
        while (parentMenu = this.parentMenu.pop()) {
            parentMenu.remove();
        }
        this.parentItems = [];

        RadialMenu.setClassAndWaitForTransition(this.currentMenu, 'menu inner').then(() => {
            this.currentMenu.remove();
            this.currentMenu = null;
        });

        if (this.onClose) {
            this.onClose();
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.getParentMenu = function () {
    if (this.parentMenu.length > 0) {
        return this.parentMenu[this.parentMenu.length - 1];
    } else {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createHolder = function () {
    this.holder = document.createElement('div');
    this.holder.className = 'menuHolder';
    this.holder.style.width  = this.size + 'px';
    this.holder.style.height = this.size + 'px';

    this.parent.appendChild(this.holder);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.showNestedMenu = function (item) {
    this.parentMenu.push(this.currentMenu);
    this.parentItems.push(this.levelItems);
    this.currentMenu = this.createMenu('menu inner', item.items, true);
    this.holder.appendChild(this.currentMenu);

    // wait DOM commands to apply and then set class to allow transition to take effect
    RadialMenu.nextTick(() => {
        this.getParentMenu().setAttribute('class', 'menu outer');
        this.currentMenu.setAttribute('class', 'menu');
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.returnToParentMenu = function () {
    this.getParentMenu().setAttribute('class', 'menu');
    RadialMenu.setClassAndWaitForTransition(this.currentMenu, 'menu inner').then(() => {
        this.currentMenu.remove();
        this.currentMenu = this.parentMenu.pop();
        this.levelItems = this.parentItems.pop();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.handleClick = function () {
    var selectedIndex = this.getSelectedIndex();
    if (selectedIndex >= 0) {
        var item = this.levelItems[selectedIndex];
        if (item.items) {
            this.showNestedMenu(item);
        } else {
            if (this.onClick) {
                this.onClick(item);
                if (this.closeOnClick) {
                    this.close(false);
                }
            }
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.handleCenterClick = function () {
    if (this.parentItems.length > 0) {
        this.returnToParentMenu();
    } else {
        this.close();
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.getIndexOffset = function () {
    if (this.levelItems.length < this.sectorCount) {
        switch (this.levelItems.length) {
            case 1:
                return -2;
            case 2:
                return -2;
            case 3:
                return -2;
            default:
                return -1;
        }
    } else {
        return -1;
    }

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createMenu = function (classValue, levelItems) {
    this.levelItems = levelItems;

    this.sectorCount = Math.max(this.levelItems.length, MIN_SECTORS);
    this.scale       = this.calcScale();

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classValue);
    svg.setAttribute('viewBox', '-50 -50 100 100');
    svg.setAttribute('width', this.size);
    svg.setAttribute('height', this.size);

    var angleStep   = 360 / this.sectorCount;
    var angleShift  = angleStep / 2 + 270;

    var indexOffset = this.getIndexOffset();

    for (var i = 0; i < this.sectorCount; ++i) {
        var startAngle = angleShift + angleStep * i;
        var endAngle   = angleShift + angleStep * (i + 1);

        var itemIndex = RadialMenu.resolveLoopIndex(this.sectorCount - i + indexOffset, this.sectorCount);
        var item;
        if (itemIndex >= 0 && itemIndex < this.levelItems.length) {
            item = this.levelItems[itemIndex];
        } else {
            item = null;
        }

        this.appendSectorPath(startAngle, endAngle, svg, item, itemIndex);
    }

    svg.addEventListener('mousedown', (event) => {
        var className = event.target.parentNode.getAttribute('class').split(' ')[0];
        switch (className) {
            case 'sector':
                var index = parseInt(event.target.parentNode.getAttribute('data-index'));
                if (!isNaN(index)) {
                    this.setSelectedIndex(index);
                }
                break;
            default:
        }
    });

    svg.addEventListener('click', () => {
        var className = event.target.parentNode.getAttribute('class').split(' ')[0];
        switch (className) {
            case 'sector':
                this.handleClick();
                break;
            case 'center':
                this.handleCenterClick();
                break;
            default:
        }
    });
    return svg;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.selectDelta = function (indexDelta) {
    var selectedIndex = this.getSelectedIndex();
    if (selectedIndex < 0) {
        selectedIndex = 0;
    }
    selectedIndex += indexDelta;

    if (selectedIndex < 0) {
        selectedIndex = this.levelItems.length + selectedIndex;
    } else if (selectedIndex >= this.levelItems.length) {
        selectedIndex -= this.levelItems.length;
    }
    this.setSelectedIndex(selectedIndex);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.onKeyDown = function (event) {
    if (this.currentMenu) {
        switch (event.key) {
            case 'Escape':
            case 'Backspace':
                this.handleCenterClick();
                event.preventDefault();
                break;
            case 'Enter':
                this.handleClick();
                event.preventDefault();
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                this.selectDelta(1);
                event.preventDefault();
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                this.selectDelta(-1);
                event.preventDefault();
                break;
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.onMouseWheel = function (event) {
    if (this.currentMenu) {
        var delta = -event.deltaY;

        if (delta > 0) {
            this.selectDelta(1)
        } else {
            this.selectDelta(-1)
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.getSelectedNode = function () {
    var items = this.currentMenu.getElementsByClassName('selected');
    if (items.length > 0) {
        return items[0];
    } else {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.getSelectedIndex = function () {
    var selectedNode = this.getSelectedNode();
    if (selectedNode) {
        return parseInt(selectedNode.getAttribute('data-index'));
    } else {
        return -1;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.setSelectedIndex = function (index) {
    if (index >=0 && index < this.levelItems.length) {
        var items = this.currentMenu.querySelectorAll('g[data-index="' + index + '"]');
        if (items.length > 0) {
            var itemToSelect = items[0];
            var selectedNode = this.getSelectedNode();
            if (selectedNode) {
                selectedNode.setAttribute('class', 'sector');
            }
            itemToSelect.setAttribute('class', 'sector selected');
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createUseTag = function (x, y, link) {
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('x', RadialMenu.numberToString(x));
    use.setAttribute('y', RadialMenu.numberToString(y));
    use.setAttribute('width', '10');
    use.setAttribute('height', '10');
    use.setAttribute('fill', 'white');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', link);
    use.setAttribute('href', link);
    return use;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.appendSectorPath = function (startAngleDeg, endAngleDeg, svg, item, index) {
    var centerPoint = this.getSectorCenter(startAngleDeg, endAngleDeg);
    var translate = {
        x: RadialMenu.numberToString((1 - this.scale) * centerPoint.x),
        y: RadialMenu.numberToString((1 - this.scale) * centerPoint.y)
    };

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform','translate(' +translate.x + ' ,' + translate.y + ') scale(' + this.scale + ')');

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', this.createSectorCmds(startAngleDeg, endAngleDeg));
    g.appendChild(path);

    if (item) {
        g.setAttribute('class', 'sector');
        if (index == 0) {
            g.setAttribute('class', 'sector selected');
        }
        g.setAttribute('data-id', item.id);
        g.setAttribute('data-index', index);

        if (item.title) {
            var text = this.createText(centerPoint.x, centerPoint.y, item.title);
            if (item.icon) {
                text.setAttribute('transform', 'translate(0,8)');
            } else {
                text.setAttribute('transform', 'translate(0,2)');
            }

            g.appendChild(text);
        }

        if (item.icon) {
            var use = this.createUseTag(centerPoint.x, centerPoint.y, item.icon);
            if (item.title) {
                use.setAttribute('transform', 'translate(-5,-8)');
            } else {
                use.setAttribute('transform', 'translate(-5,-5)');
            }

            g.appendChild(use);
        }

    } else {
        g.setAttribute('class', 'dummy');
    }

    svg.appendChild(g);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createSectorCmds = function (startAngleDeg, endAngleDeg) {
    var initPoint = RadialMenu.getDegreePos(startAngleDeg, this.radius);
    var path = 'M' + RadialMenu.pointToString(initPoint);

    var radiusAfterScale = this.radius * (1 / this.scale);
    path += 'A' + radiusAfterScale + ' ' + radiusAfterScale + ' 0 0 0' + RadialMenu.pointToString(RadialMenu.getDegreePos(endAngleDeg, this.radius));
    path += 'L' + RadialMenu.pointToString(RadialMenu.getDegreePos(endAngleDeg, this.innerRadius));

    var radiusDiff = this.radius - this.innerRadius;
    var radiusDelta = (radiusDiff - (radiusDiff * this.scale)) / 2;
    var innerRadius = (this.innerRadius + radiusDelta) * (1 / this.scale);
    path += 'A' + innerRadius + ' ' + innerRadius + ' 0 0 1 ' + RadialMenu.pointToString(RadialMenu.getDegreePos(startAngleDeg, this.innerRadius));
    path += 'Z';

    return path;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createText = function (x, y, title) {
    var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('x', RadialMenu.numberToString(x));
    text.setAttribute('y', RadialMenu.numberToString(y));
    text.setAttribute('font-size', '38%');
    text.innerHTML = title;
    return text;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.createCircle = function (x, y, r) {
    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx',RadialMenu.numberToString(x));
    circle.setAttribute('cy',RadialMenu.numberToString(y));
    circle.setAttribute('r',r);
    return circle;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.calcScale = function () {
    var totalSpace = this.sectorSpace * this.sectorCount;
    var circleLength = Math.PI * 2 * this.radius;
    var radiusDelta = this.radius - (circleLength - totalSpace) / (Math.PI * 2);
    return (this.radius - radiusDelta) / this.radius;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.getSectorCenter = function (startAngleDeg, endAngleDeg) {
    return RadialMenu.getDegreePos((startAngleDeg + endAngleDeg) / 2, this.innerRadius + (this.radius - this.innerRadius) / 2);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.prototype.addIconSymbols = function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icons');

    // return
    var returnSymbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    returnSymbol.setAttribute('id', 'return');
    returnSymbol.setAttribute('viewBox', '0 0 489.394 489.394');
    var returnPath =   document.createElementNS('http://www.w3.org/2000/svg', 'path');
    returnPath.setAttribute('d', "M375.789,92.867H166.864l17.507-42.795c3.724-9.132,1-19.574-6.691-25.744c-7.701-6.166-18.538-6.508-26.639-0.879" +
        "L9.574,121.71c-6.197,4.304-9.795,11.457-9.563,18.995c0.231,7.533,4.261,14.446,10.71,18.359l147.925,89.823" +
        "c8.417,5.108,19.18,4.093,26.481-2.499c7.312-6.591,9.427-17.312,5.219-26.202l-19.443-41.132h204.886" +
        "c15.119,0,27.418,12.536,27.418,27.654v149.852c0,15.118-12.299,27.19-27.418,27.19h-226.74c-20.226,0-36.623,16.396-36.623,36.622" +
        "v12.942c0,20.228,16.397,36.624,36.623,36.624h226.74c62.642,0,113.604-50.732,113.604-113.379V206.709" +
        "C489.395,144.062,438.431,92.867,375.789,92.867z");
    returnSymbol.appendChild(returnPath);
    svg.appendChild(returnSymbol);

    var closeSymbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    closeSymbol.setAttribute('id', 'close');
    closeSymbol.setAttribute('viewBox', '0 0 41.756 41.756');

    var closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('d', "M27.948,20.878L40.291,8.536c1.953-1.953,1.953-5.119,0-7.071c-1.951-1.952-5.119-1.952-7.07,0L20.878,13.809L8.535,1.465" +
        "c-1.951-1.952-5.119-1.952-7.07,0c-1.953,1.953-1.953,5.119,0,7.071l12.342,12.342L1.465,33.22c-1.953,1.953-1.953,5.119,0,7.071" +
        "C2.44,41.268,3.721,41.755,5,41.755c1.278,0,2.56-0.487,3.535-1.464l12.343-12.342l12.343,12.343" +
        "c0.976,0.977,2.256,1.464,3.535,1.464s2.56-0.487,3.535-1.464c1.953-1.953,1.953-5.119,0-7.071L27.948,20.878z");
    closeSymbol.appendChild(closePath);
    svg.appendChild(closeSymbol);

    this.holder.appendChild(svg);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.getDegreePos = function (angleDeg, length) {
    return {
        x: Math.sin(RadialMenu.degToRad(angleDeg)) * length,
        y: Math.cos(RadialMenu.degToRad(angleDeg)) * length
    };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.pointToString = function (point) {
    return RadialMenu.numberToString(point.x) + ' ' + RadialMenu.numberToString(point.y);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.numberToString = function (n) {
    if (Number.isInteger(n)) {
        return n.toString();
    } else if (n) {
        var r = (+n).toFixed(5);
        if (r.match(/\./)) {
            r = r.replace(/\.?0+$/, '');
        }
        return r;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.resolveLoopIndex = function (index, length) {
    if (index < 0) {
        index = length + index;
    }
    if (index >= length) {
        index = index - length;
    }
    if (index < length) {
        return index;
    } else {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.degToRad = function (deg) {
    return deg * (Math.PI / 180);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.setClassAndWaitForTransition = function (node, newClass) {
    return new Promise(function (resolve) {
        function handler(event) {
            if (event.target == node && event.propertyName == 'visibility') {
                node.removeEventListener('transitionend', handler);
                resolve();
            }
        }
        node.addEventListener('transitionend', handler);
        node.setAttribute('class', newClass);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
RadialMenu.nextTick = function (fn) {
    setTimeout(fn, 10);
};
