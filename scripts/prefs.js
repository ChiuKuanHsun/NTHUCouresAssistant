// scripts/prefs.js
// 集中管理「偏好設定」：這些是每次開啟選課頁時要自動套用的預設值。

const NthuCoursePrefs = {
    // 整份設定存在同一個 key，欄位少、體積小，不會踩到 sync 的 8KB 單項上限
    KEY: 'nthuHelperPrefs',
    // 舊版這兩項各自存成獨立的 top-level key（設定介面在 popup 裡），
    // 對應到現在整份設定裡的欄位名稱
    LEGACY_KEYS: {
        framesetRatio: 'framesetRatio',
        allowGeClash: 'defaultAllowGeClash'
    },

    DEFAULTS: {
        defaultHideClash: false,
        defaultAllowGeClash: false,
        defaultAllowXClassClash: false,
        defaultExcludeNanda: false,
        defaultAutoRefreshCounts: false,
        framesetRatio: 350
    },

    // 供偏好設定視窗渲染用；順序即畫面上的順序
    ITEMS: [
        {
            key: 'defaultHideClash',
            type: 'toggle',
            label: '預設隱藏衝堂課程',
            hint: '開啟選課頁時自動勾選「隱藏衝堂課程」。'
        },
        {
            key: 'defaultAllowGeClash',
            type: 'toggle',
            label: '預設允許通識衝堂',
            hint: '開啟通識選課頁時自動勾選「允許通識衝堂」；需搭配「隱藏衝堂課程」才會看到效果。'
        },
        {
            key: 'defaultAllowXClassClash',
            type: 'toggle',
            label: '預設允許 X-Class 衝堂',
            hint: '開啟選課頁時自動勾選「允許X-Class衝堂」。'
        },
        {
            key: 'defaultExcludeNanda',
            type: 'toggle',
            label: '預設排除南大校區',
            hint: '開啟選課頁時校區篩選只勾選「校本部」。'
        },
        {
            key: 'defaultAutoRefreshCounts',
            type: 'toggle',
            label: '預設自動更新即時人數',
            hint: '開啟選課頁時自動抓一次即時人數，不必再按按鈕。'
        },
        {
            key: 'framesetRatio',
            type: 'range',
            label: '自動調整頁面框架比例',
            hint: '拖曳即時套用，放開後儲存；下次開啟選課頁也會沿用。',
            min: 0,
            max: 900,
            step: 10,
            minLabel: '上方 (課程列表)',
            maxLabel: '下方 (已選課表)'
        }
    ],

    async load() {
        const legacyKeys = Object.keys(this.LEGACY_KEYS);
        const stored = await chrome.storage.sync.get([this.KEY, ...legacyKeys]);
        const saved = stored[this.KEY] || {};
        const prefs = { ...this.DEFAULTS, ...saved };

        // 把舊版獨立存放的設定搬進整份設定，之後只認 KEY 這一個來源。
        // 已經在新設定裡動過的欄位不覆蓋，舊值只是被丟掉。
        const presentLegacyKeys = legacyKeys.filter(k => stored[k] !== undefined);
        if (presentLegacyKeys.length > 0) {
            presentLegacyKeys.forEach(legacyKey => {
                const prefKey = this.LEGACY_KEYS[legacyKey];
                if (saved[prefKey] !== undefined) return;
                prefs[prefKey] = typeof this.DEFAULTS[prefKey] === 'number'
                    ? (Number(stored[legacyKey]) || this.DEFAULTS[prefKey])
                    : !!stored[legacyKey];
            });
            await chrome.storage.sync.set({ [this.KEY]: prefs });
            await chrome.storage.sync.remove(presentLegacyKeys);
        }
        return prefs;
    },

    // 只更新單一項目，避免兩個分頁同時開著時互相覆蓋整份設定
    async set(key, value) {
        const current = await this.load();
        const next = { ...current, [key]: value };
        await chrome.storage.sync.set({ [this.KEY]: next });
        return next;
    }
};
