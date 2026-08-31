// scripts/gradeStats.js
// 查詢校務資訊系統 8.4.2「開課課程等級制成績平均值及標準差」(JH84202.php)
//
// 這支頁面吃的是 POST，欄位有：
//   ACIXSTORE  登入憑證（跟選課系統共用同一個 token）
//   qyt        學期代碼，格式 "114|10"（114 學年度上學期）
//   kwc        課程名稱關鍵字
//   kwt        教師姓名關鍵字
//   sort       排序欄位
// 成績要等學期結束才會匯入，所以查得到的最新資料一定早於目前這個學期。

const NthuGradeStats = {
    ENDPOINT: 'https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/8/8.4/8.4.2/JH84202.php',

    _queryCache: new Map(),
    _big5Encoder: null,

    /**
     * 取得 ACIXSTORE。加選頁面自己的表單就有一份隱藏欄位，
     * 找不到才往上翻 topFrame（parser.js 抓即時人數時也是這樣拿的）。
     */
    getAcixstore() {
        const local = document.querySelector('input[name="ACIXSTORE"]');
        if (local && local.value) return local.value;

        try {
            const topFrameInput = window.top.frames['topFrame']
                ?.document.querySelector('input[name="ACIXSTORE"]');
            if (topFrameInput && topFrameInput.value) return topFrameInput.value;
        } catch (error) {
            // 理論上同源，真的讀不到就往下用網址列的值
        }

        return new URLSearchParams(window.location.search).get('ACIXSTORE') || null;
    },

    // --- 學期代碼 ---------------------------------------------------------

    // 科號前 5 碼就是學期代碼，例如 "11510GE 168200" -> { year: 115, semester: '10' }
    parseTerm(courseId) {
        const match = (courseId || '').replace(/\s+/g, '').match(/^(\d{3})(10|20)/);
        return match ? { year: Number(match[1]), semester: match[2] } : null;
    },

    // 沒有科號可推算時的備案：8 月起算新學年，2~7 月算下學期
    currentTermFromDate() {
        const now = new Date();
        const rocYear = now.getFullYear() - 1911;
        return now.getMonth() + 1 >= 8
            ? { year: rocYear, semester: '10' }
            : { year: rocYear - 1, semester: '20' };
    },

    formatTerm(year, semester) {
        return `${year}|${semester}`;
    },

    termLabel(value) {
        const [year, semester] = String(value).split('|');
        return `${year} 學年度${semester === '20' ? '下' : '上'}學期`;
    },

    /**
     * 預設要查的學期：同一個學期、前一個學年。
     * 秋季課跟秋季課比才有意義，而且當學年的成績還沒出來。
     */
    defaultTerm(courseId) {
        const term = this.parseTerm(courseId);
        return term ? this.formatTerm(term.year - 1, term.semester) : null;
    },

    /**
     * 下拉選單要列的學期：從前一學年的上學期起，一路列到目前學期的前一個學期。
     *
     * 查得到的最早就是前一學年上學期，最晚則是上一個已經結算成績的學期，
     * 所以上學期選課時有兩個選項、下學期選課時有三個：
     *   115 上 -> 114 上、114 下
     *   115 下 -> 114 上、114 下、115 上
     * 依時間先後排列。
     */
    termOptions(courseId) {
        const current = this.parseTerm(courseId) || this.currentTermFromDate();
        const currentValue = this.formatTerm(current.year, current.semester);
        const values = [];

        let year = current.year - 1;
        let semester = '10';
        // 上限純粹是保險，避免學期代碼異常時在這裡空轉
        while (this.formatTerm(year, semester) !== currentValue && values.length < 4) {
            values.push(this.formatTerm(year, semester));
            if (semester === '10') {
                semester = '20';
            } else {
                semester = '10';
                year += 1;
            }
        }

        return values.map(value => ({ value, label: this.termLabel(value) }));
    },

    // --- 送出查詢 ---------------------------------------------------------

    /**
     * 建 Unicode -> Big5 的對照表。
     *
     * 瀏覽器只給得起 TextDecoder('big5')（解碼），沒有對應的編碼器，
     * 所以反過來把 Big5 全區的雙位元組各解一次，倒出一張反查表。
     * 只掃 0xA1–0xF9 這段傳統 Big5：0x81 起的 HKSCS 擴充區有不少字跟傳統區重複，
     * 用到那邊的碼位 ccxp 反而認不得。約一萬三千組，建一次就快取起來。
     */
    getBig5Encoder() {
        if (this._big5Encoder) return this._big5Encoder;

        const decoder = new TextDecoder('big5');
        const map = new Map();
        const pair = new Uint8Array(2);
        for (let lead = 0xA1; lead <= 0xF9; lead++) {
            for (let trail = 0x40; trail <= 0xFE; trail++) {
                if (trail > 0x7E && trail < 0xA1) continue; // Big5 次位元組的空隙
                pair[0] = lead;
                pair[1] = trail;
                const text = decoder.decode(pair);
                // 未定義的碼位會解成 U+FFFD；同一個字對到多個碼位時保留先掃到的
                if (text && !text.includes('�') && !map.has(text)) {
                    map.set(text, [lead, trail]);
                }
            }
        }

        this._big5Encoder = map;
        return map;
    },

    /**
     * 把欄位編成 Big5 的 application/x-www-form-urlencoded 內容。
     *
     * JH84202.php 是 Big5 頁面，中文課名／教師名要送 Big5 位元組伺服器才認得，
     * 而 FormData／URLSearchParams 一律送 UTF-8，所以這裡自己編。
     */
    encodeBig5Form(fields) {
        const encoder = this.getBig5Encoder();
        const unsupported = [];

        const encodeValue = (value) => {
            let out = '';
            for (const char of String(value)) {
                const code = char.charCodeAt(0);
                if (/[A-Za-z0-9*\-._]/.test(char)) {
                    out += char;
                } else if (char === ' ') {
                    out += '+';
                } else if (char.length === 1 && code < 0x80) {
                    out += '%' + code.toString(16).toUpperCase().padStart(2, '0');
                } else {
                    const bytes = encoder.get(char);
                    if (bytes) {
                        out += bytes.map(byte => '%' + byte.toString(16).toUpperCase()).join('');
                    } else {
                        unsupported.push(char);
                        out += '%3F'; // Big5 沒有這個字，送 '?'
                    }
                }
            }
            return out;
        };

        const body = Object.entries(fields)
            .map(([name, value]) => `${encodeValue(name)}=${encodeValue(value)}`)
            .join('&');

        if (unsupported.length) {
            console.warn('成績查詢：以下字元不在 Big5 內，已改送 ?：', unsupported.join(''));
        }
        return body;
    },

    /**
     * 送出查詢並解析結果。
     * 回應頁在 session 逾期時會用 window.top.location 把整個選課頁面導走，
     * 但 DOMParser 不會執行 script，所以拉不動我們。
     */
    async submitQuery(fields) {
        const response = await fetch(this.ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: this.encodeBig5Form(fields)
        });
        if (!response.ok) throw new Error(`伺服器錯誤: ${response.status}`);

        const html = new TextDecoder('big5').decode(await response.arrayBuffer());
        return this.extractResult(new DOMParser().parseFromString(html, 'text/html'));
    },

    // 資料列一定有一格是科號：5 碼學期代碼接著系所代號，例如 "11410CS  210401"
    COURSE_ID_PATTERN: /^\d{5}[A-Za-z\s]/,

    /**
     * 課名轉成查詢用的關鍵字。
     *
     * 課表上的課名會在後面附授課語言的標註，例如「經濟學原理一－英語授課」
     * （中間是全形連字號 U+FF0D）。成績查詢那邊的課名沒有這一段，
     * 照原樣送出就查不到東西，所以先去掉。
     * 破折號的寫法各年度不一定一致，全形／半形／各種破折號都一起處理。
     */
    searchableCourseName(name) {
        const cleaned = (name || '')
            .replace(/[（(]\s*(全英語|英語|英文)\s*授課\s*[）)]/g, '')
            .replace(/[－–—\-‐‑]\s*(全英語|英語|英文)\s*授課\s*$/, '')
            .trim();
        // 萬一整個課名都被削掉了，寧可用原本的課名去查
        return cleaned || (name || '').trim();
    },

    /**
     * 取儲存格文字。<br> 在 textContent 不留任何空白，
     * 直接讀會讓中英文課名（硬體設計與實驗 / Hardware Design and Lab.）黏成一串，
     * 所以先把 <br> 換成換行，之後顯示時再還原成 <br>。
     */
    cellText(cell) {
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        return clone.textContent
            .split('\n')
            .map(line => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join('\n');
    },

    /**
     * 把跨欄／跨列的表頭攤平成「一欄一個名稱」。
     *
     * 8.4.2 的表頭是兩層的：
     *   科號 | 科目名稱 | 教師 | 修課人數 |   等級制   |   百分制
     *                                      平均 標準差 平均 標準差
     * 上層的「等級制」「百分制」各 colspan=2，左邊四欄則是 rowspan=2。
     * 只讀其中一列一定會少欄位，欄名就會跟資料對不起來（修課人數跑到標準差那一欄）。
     * 這裡按 colspan/rowspan 展開成格點，再把同一欄由上而下的字串接起來，
     * 得到「等級制平均」「等級制標準差」「百分制平均」「百分制標準差」。
     */
    flattenHeader(headerRows) {
        const grid = [];
        headerRows.forEach((row, rowIndex) => {
            if (!grid[rowIndex]) grid[rowIndex] = [];
            let column = 0;
            for (const cell of row.cells) {
                // 上一列 rowspan 佔走的位置要跳過
                while (grid[rowIndex][column] !== undefined) column += 1;

                const text = this.cellText(cell).replace(/\n/g, ' ');
                const colSpan = cell.colSpan || 1;
                const rowSpan = cell.rowSpan || 1;
                for (let r = 0; r < rowSpan; r++) {
                    const target = rowIndex + r;
                    if (!grid[target]) grid[target] = [];
                    for (let c = 0; c < colSpan; c++) {
                        grid[target][column + c] = text;
                    }
                }
                column += colSpan;
            }
        });

        const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
        const labels = [];
        for (let column = 0; column < width; column++) {
            const parts = [];
            for (const row of grid) {
                const text = row[column];
                // rowspan 會讓同一個字串重複出現在好幾列，只取一次
                if (text && !parts.includes(text)) parts.push(text);
            }
            labels.push(parts.join(''));
        }
        return labels;
    },

    /**
     * 從回應頁挖出成績表格。
     * ccxp 的版面是層層巢狀的 <table>，所以先挑出「內容含標準差」的表，
     * 再取其中最內層的那一張（沒有再包住其他候選表的那個）。
     */
    extractResult(doc) {
        const bodyText = doc.body ? doc.body.textContent : '';
        if (/session is interrupted/i.test(bodyText)) {
            throw new Error('校務資訊系統的登入階段已逾期，請重新登入後再查詢。');
        }

        const candidates = [...doc.querySelectorAll('table')].filter(table => {
            const text = table.textContent;
            return text.includes('標準差') && (text.includes('平均') || text.includes('科號'));
        });
        const table = candidates.find(
            candidate => !candidates.some(other => other !== candidate && candidate.contains(other))
        );

        const empty = { headers: [], rows: [], columnIndexes: {} };
        if (!table) return empty;

        const isDataRow = (row) => row.cells.length >= 3
            && [...row.cells].some(cell => this.COURSE_ID_PATTERN.test(this.cellText(cell)));

        const allRows = [...table.rows];
        let dataRows = allRows.filter(isDataRow);
        // 後備：ccxp 偶爾把表頭和資料放在兩張相鄰的表裡，上面挑到的那張只有表頭
        if (!dataRows.length) {
            dataRows = [...doc.querySelectorAll('tr')].filter(isDataRow);
        }

        // 表頭是資料列之前的那幾列。整列只有一格又跨很多欄的是標題不是表頭，
        // 留著會讓每一欄的名稱前面都黏上那段標題。
        const firstDataIndex = dataRows.length ? allRows.indexOf(dataRows[0]) : -1;
        const headerRows = (firstDataIndex > 0 ? allRows.slice(0, firstDataIndex) : allRows)
            .filter(row => row.cells.length > 0)
            .filter(row => !(row.cells.length === 1 && (row.cells[0].colSpan || 1) > 1));

        const headers = this.flattenHeader(headerRows);
        const columnCount = dataRows.reduce((max, row) => Math.max(max, row.cells.length), headers.length);
        while (headers.length < columnCount) headers.push('');

        const rows = dataRows.map(row => {
            const cells = [...row.cells].map(cell => this.cellText(cell));
            while (cells.length < columnCount) cells.push('');
            return cells;
        });

        if (!rows.length) {
            // 查無資料時本來就會是空的，但表格長得跟預期不同時也會落到這裡，
            // 把實際抓到的表頭印出來，之後要調整比對規則才有依據
            console.debug('成績查詢：沒有解析到資料列，偵測到的表頭為', headers);
        }

        // 只有高亮需要知道這幾欄在哪，找不到也不影響表格本身照原樣顯示。
        // 「等級制平均」也含「平均」，所以成績欄不在這裡認，只認前三欄。
        const columnIndexes = {};
        headers.forEach((text, index) => {
            if (columnIndexes.id === undefined && text.includes('科號')) {
                columnIndexes.id = index;
            } else if (columnIndexes.name === undefined && /(課程|科目).*名稱|課程中文/.test(text)) {
                columnIndexes.name = index;
            } else if (columnIndexes.teacher === undefined && /教師|教授/.test(text)) {
                columnIndexes.teacher = index;
            }
        });

        return { headers, rows, columnIndexes };
    },

    /**
     * 查詢。同樣的條件只會真的送一次請求。
     * @param {{keyword: string, mode: 'course'|'teacher', term: string}} options
     */
    query({ keyword, mode, term }) {
        const trimmed = (keyword || '').trim();
        if (!trimmed) return Promise.reject(new Error('請輸入查詢關鍵字。'));
        if (!term) return Promise.reject(new Error('沒有可查詢的學期。'));

        const cacheKey = `${term} ${mode} ${trimmed}`;
        if (this._queryCache.has(cacheKey)) return this._queryCache.get(cacheKey);

        const acixstore = this.getAcixstore();
        if (!acixstore) {
            return Promise.reject(new Error('取不到登入憑證 (ACIXSTORE)，請重新登入校務資訊系統。'));
        }

        const promise = this.submitQuery({
            ACIXSTORE: acixstore,
            qyt: term,
            kwc: mode === 'teacher' ? '' : trimmed,
            kwt: mode === 'teacher' ? trimmed : '',
            sort: 'ckey',
            Submit: '確定 Submit'
        });

        // 失敗的結果不留在快取裡，否則使用者重按也永遠是同一個錯誤
        promise.catch(() => this._queryCache.delete(cacheKey));
        this._queryCache.set(cacheKey, promise);
        return promise;
    },

    /**
     * 找出結果中屬於「使用者點的那一門課」的列。
     * 同名課程常常有好幾位老師開，全部列出來才好比較，但要標出點進來的那一筆。
     *
     * 兩個條件任一命中就算：
     *   1. 教師欄含有課表上的教師姓名（課表的教師欄可能中英文各一行）
     *   2. 科號去掉前 5 碼的學期代碼後相同 —— 同一門課逐年多半沿用同一組編號
     *
     * @returns {Set<number>} 命中列在 result.rows 中的索引
     */
    findMatchingRows(result, course) {
        const matched = new Set();
        if (!result || !result.rows.length || !course) return matched;

        const teacherNames = (course.teacher || '')
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 1);
        const idSuffix = (course.id || '').replace(/\s+/g, '').slice(5);
        const { teacher: teacherColumn, id: idColumn } = result.columnIndexes;

        result.rows.forEach((cells, index) => {
            const teacherText = teacherColumn !== undefined ? cells[teacherColumn] || '' : '';
            const idText = idColumn !== undefined ? (cells[idColumn] || '').replace(/\s+/g, '') : '';

            const teacherHit = teacherNames.some(name => teacherText.includes(name));
            const idHit = idSuffix.length > 2 && idText.endsWith(idSuffix);
            if (teacherHit || idHit) matched.add(index);
        });

        return matched;
    }
};
