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
    // 機密類設定（API key）另外存在 storage.local：
    // 不跟著 Google 帳號同步到其他裝置，也不會混進上面那份會同步的設定裡。
    // background.js 讀 key 時用的是同一個 KEY。
    SECRETS_KEY: 'nthuHelperSecrets',
    SECRET_KEYS: ['geminiApiKey'],

    DEFAULTS: {
        defaultHideClash: false,
        defaultAllowGeClash: false,
        defaultAllowXClassClash: false,
        defaultExcludeNanda: false,
        defaultAutoRefreshCounts: false,
        framesetRatio: 350,
        // AI 大綱統整
        geminiApiKey: '',
        aiModel: 'gemini-3.5-flash-lite',
        aiLanguage: 'zh-TW'
    },

    // AI 摘要的回答語言。prompt 欄位是塞進 system instruction 的英文描述。
    AI_LANGUAGES: [
        { value: 'zh-TW', label: '繁體中文', prompt: 'Traditional Chinese (繁體中文, Taiwan usage)' },
        { value: 'en', label: 'English', prompt: 'English' },
        { value: 'ja', label: '日本語', prompt: 'Japanese' },
        { value: 'ko', label: '한국어', prompt: 'Korean' }
    ],

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
        },
        {
            type: 'heading',
            label: 'AI 大綱統整',
            hint: '用 Gemini 把課程大綱整理成評分方式、作業考試、AI 使用限制等重點。'
        },
        {
            key: 'geminiApiKey',
            type: 'secret',
            label: 'Google AI Studio API Key',
            hint: '到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> 免費建立。只存在這台電腦，不會同步到其他裝置。',
            placeholder: 'AIza…'
        },
        {
            key: 'aiModel',
            type: 'text',
            label: 'Gemini 模型',
            hint: '預設 gemini-3.5-flash-lite（快、免費額度多）；想要更好的品質可改成 gemini-3.5-flash。',
            placeholder: 'gemini-3.5-flash-lite'
        },
        {
            key: 'aiLanguage',
            type: 'select',
            label: '摘要回答語言',
            hint: '不論大綱是中文還是英文，一律用這個語言回答。',
            options: 'AI_LANGUAGES'
        }
    ],

    async load() {
        const legacyKeys = Object.keys(this.LEGACY_KEYS);
        const [stored, localStored] = await Promise.all([
            chrome.storage.sync.get([this.KEY, ...legacyKeys]),
            chrome.storage.local.get(this.SECRETS_KEY)
        ]);
        const saved = stored[this.KEY] || {};
        const secrets = localStored[this.SECRETS_KEY] || {};
        const prefs = { ...this.DEFAULTS, ...saved, ...secrets };

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
            await chrome.storage.sync.set({ [this.KEY]: this.withoutSecrets(prefs) });
            await chrome.storage.sync.remove(presentLegacyKeys);
        }
        return prefs;
    },

    // 只更新單一項目，避免兩個分頁同時開著時互相覆蓋整份設定
    async set(key, value) {
        if (this.SECRET_KEYS.includes(key)) {
            const stored = await chrome.storage.local.get(this.SECRETS_KEY);
            const next = { ...(stored[this.SECRETS_KEY] || {}), [key]: value };
            await chrome.storage.local.set({ [this.SECRETS_KEY]: next });
            return next;
        }
        const current = await this.load();
        const next = { ...current, [key]: value };
        await chrome.storage.sync.set({ [this.KEY]: this.withoutSecrets(next) });
        return next;
    },

    // 機密欄位不能寫進會同步的那份
    withoutSecrets(prefs) {
        const copy = { ...prefs };
        this.SECRET_KEYS.forEach(secretKey => { delete copy[secretKey]; });
        return copy;
    },

    // 空白模型名稱視同沒設定，退回預設值
    resolveModel(prefs) {
        const model = (prefs.aiModel || '').trim();
        return model || this.DEFAULTS.aiModel;
    },

    resolveLanguage(prefs) {
        return this.AI_LANGUAGES.find(lang => lang.value === prefs.aiLanguage)
            || this.AI_LANGUAGES[0];
    }
};
