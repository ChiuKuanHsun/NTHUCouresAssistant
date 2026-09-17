// scripts/icons.js
// 擴充功能自己畫的 SVG 圖示（線條風格，24x24 viewBox，stroke 吃 currentColor）。
// 不用 emoji：各平台字型長得不一樣、也沒辦法跟著按鈕的顏色走。

const NthuIcons = {
    PATHS: {
        // 放大鏡：查詢課程評價
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        // 長條圖：歷年成績分佈
        chart: '<path d="M3 3v18h18"/><path d="M8 17v-4"/><path d="M13 17V8"/><path d="M18 17v-7"/>',
        // 星芒：AI 統整
        sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 3v3"/><path d="M20.5 4.5h-3"/><path d="M5 17v3"/><path d="M6.5 18.5h-3"/>',
        // 信封：教師 email
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        // 垃圾桶：清除已存的 API key
        trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    },

    /**
     * @param {string} name - PATHS 的 key
     * @param {number} [size=16] - 寬高（px）
     * @param {string} [className] - 額外 class
     * @returns {string} 可直接塞進 innerHTML 的 <svg>
     */
    svg(name, size = 16, className = '') {
        const paths = this.PATHS[name] || '';
        return `<svg class="nthu-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" `
            + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + paths + '</svg>';
    }
};
