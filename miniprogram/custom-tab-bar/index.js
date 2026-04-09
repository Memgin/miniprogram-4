Component({
  data: {
    hidden: false,
    selected: 0,
    visualSelected: 0,
    pressedIndex: -1,
    slideHoverIndex: -1,
    highlightX: 50,
    highlightY: 16,
    isTracking: false,
    list: [
      {
        pagePath: 'pages/index/index',
        text: '工具',
        iconPath: '/images/icons/home.png',
        selectedIconPath: '/images/icons/home-active.png'
      },
      {
        pagePath: 'pages/xishu/xishu',
        text: '悉数',
        iconPath: '/images/icons/business.png',
        selectedIconPath: '/images/icons/business-active.png'
      }
    ]
  },

  methods: {
    hide() {
      if (this.data.hidden) return;
      this.setData({
        hidden: true,
        isTracking: false,
        pressedIndex: -1,
        slideHoverIndex: -1
      });
    },

    show() {
      if (!this.data.hidden) {
        this.updateSelected();
        return;
      }
      this.setData({ hidden: false }, () => {
        this.updateSelected();
      });
    },

    getCurrentRoute() {
      const pages = getCurrentPages();
      if (!pages || !pages.length) {
        return '';
      }
      return pages[pages.length - 1].route || '';
    },

    getTouch(e) {
      return (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || null;
    },

    ensureShellRect(callback) {
      if (this.shellRect && this.shellRect.width && this.shellRect.height) {
        callback(this.shellRect);
        return;
      }
      const query = this.createSelectorQuery();
      query.select('.lg-tabbar-shell').boundingClientRect();
      query.exec((res) => {
        const rect = res && res[0];
        if (!rect || !rect.width || !rect.height) {
          return;
        }
        this.shellRect = rect;
        callback(rect);
      });
    },

    resolveHoverIndex(touch, rect) {
      const len = this.data.list.length || 1;
      const ratioX = (touch.clientX - rect.left) / rect.width;
      const rawIndex = Math.floor(ratioX * len);
      return Math.max(0, Math.min(len - 1, rawIndex));
    },

    updateHoverByTouch(touch) {
      this.ensureShellRect((rect) => {
        const hoverIndex = this.resolveHoverIndex(touch, rect);
        if (
          hoverIndex !== this.data.slideHoverIndex ||
          hoverIndex !== this.data.visualSelected ||
          hoverIndex !== this.data.pressedIndex
        ) {
          this.setData({
            slideHoverIndex: hoverIndex,
            visualSelected: hoverIndex,
            pressedIndex: hoverIndex
          });
        }
      });
    },

    switchToIndex(index) {
      const item = this.data.list[index];
      if (!item) {
        return;
      }
      const currentRoute = this.getCurrentRoute();
      if (currentRoute === item.pagePath) {
        this.setData({
          selected: index,
          visualSelected: index
        });
        return;
      }
      this.setData({
        selected: index,
        visualSelected: index
      });
      wx.switchTab({ url: `/${item.pagePath}` });
    },

    onItemTouchStart(e) {
      const { index } = e.currentTarget.dataset;
      this.setData({ pressedIndex: Number(index) });
    },

    onItemTouchEnd() {
      if (this.data.pressedIndex !== -1) {
        this.setData({ pressedIndex: -1 });
      }
    },

    onShellTouchStart(e) {
      const touch = this.getTouch(e);
      if (!touch) {
        return;
      }
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.hasSlideMoved = false;
      this.updateHighlightFromTouch(e, true);
      this.updateHoverByTouch(touch);
    },

    onShellTouchMove(e) {
      const touch = this.getTouch(e);
      if (!touch) {
        return;
      }
      if (!this.hasSlideMoved) {
        const dx = Math.abs(touch.clientX - (this.touchStartX || touch.clientX));
        const dy = Math.abs(touch.clientY - (this.touchStartY || touch.clientY));
        if (dx > 6 || dy > 6) {
          this.hasSlideMoved = true;
        }
      }
      this.updateHighlightFromTouch(e, false);
      this.updateHoverByTouch(touch);
    },

    onShellTouchEnd() {
      const hoverIndex = this.data.slideHoverIndex;
      const shouldSwitch = this.hasSlideMoved && hoverIndex >= 0 && hoverIndex !== this.data.selected;

      if (shouldSwitch) {
        this.switchToIndex(hoverIndex);
      }

      const resetTo = shouldSwitch ? hoverIndex : this.data.selected;
      this.setData({
        isTracking: false,
        visualSelected: resetTo,
        highlightX: 50,
        highlightY: 16,
        pressedIndex: -1,
        slideHoverIndex: -1
      });
      this.hasSlideMoved = false;
    },

    updateHighlightFromTouch(e, markTracking) {
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      if (!touch) {
        return;
      }

      const updateWithRect = (rect) => {
        if (!rect || !rect.width || !rect.height) {
          return;
        }
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;
        this.setData({
          isTracking: markTracking ? true : this.data.isTracking,
          highlightX: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
          highlightY: Math.max(0, Math.min(100, Number(y.toFixed(2))))
        });
      };

      if (this.shellRect && this.shellRect.width && this.shellRect.height) {
        updateWithRect(this.shellRect);
        return;
      }

      const query = this.createSelectorQuery();
      query.select('.lg-tabbar-shell').boundingClientRect();
      query.exec((res) => {
        const rect = res && res[0];
        if (!rect) {
          return;
        }
        this.shellRect = rect;
        updateWithRect(rect);
      });
    },

    onTabTap(e) {
      const { path, index } = e.currentTarget.dataset;
      if (!path) {
        return;
      }

      const targetRoute = String(path).replace(/^\//, '');
      const currentRoute = this.getCurrentRoute();
      if (currentRoute === targetRoute) {
        if (index !== this.data.selected || index !== this.data.visualSelected) {
          this.setData({
            selected: index,
            visualSelected: index
          });
        }
        return;
      }

      this.switchToIndex(index);
    },

    updateSelected() {
      const route = this.getCurrentRoute();
      const selected = this.data.list.findIndex((item) => item.pagePath === route);
      if (selected >= 0 && (selected !== this.data.selected || selected !== this.data.visualSelected)) {
        this.setData({
          selected,
          visualSelected: selected
        });
      }
    }
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.shellRect = null;
      this.updateSelected();
    }
  }
});
