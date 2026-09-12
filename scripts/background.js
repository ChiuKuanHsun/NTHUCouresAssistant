// scripts/background.js
// MV3 service worker。目前只做一件事：代替內容腳本呼叫 Gemini API。
//
// 為什麼不直接在內容腳本 fetch：
//   1. 內容腳本的跨網域請求受頁面 CORS 規則限制，由擴充功能本體發送才不用看
//      對方伺服器臉色（host_permissions 已加上 generativelanguage.googleapis.com）。
//   2. API key 只在這裡從 storage.local 讀出來用，不必在訊息裡傳來傳去。

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// 與 prefs.js 的 SECRETS_KEY 一致：API key 存 local，不跟著 Google 帳號同步
const SECRETS_KEY = 'nthuHelperSecrets';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'GEMINI_GENERATE') return false;

    generate(message.payload || {})
        .then(result => sendResponse({ ok: true, result }))
        .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
    return true; // 非同步回覆，保留 sendResponse
});

/**
 * 呼叫 generateContent。
 * @param {Object} payload - { model, body }，body 是原封不動送給 API 的 JSON
 */
async function generate({ model, body }) {
    const stored = await chrome.storage.local.get(SECRETS_KEY);
    const apiKey = stored[SECRETS_KEY]?.geminiApiKey;
    // 內容腳本呼叫前應該已經檢查過，這裡是最後一道保險；
    // 錯誤代碼保持固定字串，讓前端能對應到「去偏好設定填 key」的提示
    if (!apiKey) throw new Error('NO_API_KEY');
    if (!model) throw new Error('未設定模型名稱。');

    const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(body)
        });
    } catch (error) {
        throw new Error('連線 Gemini API 失敗，請確認網路狀態。');
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(describeApiError(response.status, data, model));
    }
    return data;
}

// 把 API 的錯誤翻成使用者看得懂、知道下一步該做什麼的訊息
function describeApiError(status, data, model) {
    const apiMessage = data?.error?.message || '';
    if (status === 400 && /api key/i.test(apiMessage)) {
        return 'API Key 無效，請到偏好設定確認是否貼對。';
    }
    if (status === 401 || status === 403) {
        return 'API Key 沒有權限或已被停用，請到 Google AI Studio 確認。';
    }
    if (status === 404) {
        return `找不到模型「${model}」，請到偏好設定確認模型名稱。`;
    }
    if (status === 429) {
        return 'Gemini 額度已用完或請求過於頻繁，請稍後再試。';
    }
    if (status === 503 || status === 500) {
        return 'Gemini 目前忙碌中，請稍後再試。';
    }
    return `Gemini API 錯誤（${status}）：${apiMessage || '未知錯誤'}`;
}
