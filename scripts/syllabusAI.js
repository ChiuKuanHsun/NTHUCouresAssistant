// scripts/syllabusAI.js
// 用 Gemini 把課程大綱整理成固定欄位的摘要。
//
// 大綱頁（common/Syllabus/1.php）是純 GET：?ACIXSTORE=登入憑證&c_key=科號，
// 頁面上「大綱」按鈕的 syllabus() 就是 window.open 這個網址。
// 內容有兩種：
//   文字型 —「課程大綱」那格直接放全文（用 <br> 分段）
//   PDF 型 — 那格只有 keywords 加一個「觀看上傳之檔案(.pdf)」連結，
//            指到 /ccxp/INQUIRE/JH/output/…/<科號>.pdf，同源可直接抓
// Gemini 吃得下 base64 的 PDF（inlineData），所以兩種最後都走同一個 prompt，
// 不必在擴充功能裡塞 PDF 解析器。
//
// 實際打 API 的動作交給 background.js（見該檔說明），這裡只負責
// 抓大綱、組 prompt、解析回覆、以及快取。

const NthuSyllabusAI = {
    SYLLABUS_URL: 'https://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/common/Syllabus/1.php',

    // 摘要快取存 local：每筆兩三 KB，額度 10MB 綽綽有餘。
    // 大綱通常開學前後才會改，所以放得比較久；使用者也隨時可以按「重新產生」。
    CACHE_KEY: 'syllabusAISummaries',
    CACHE_TTL_MS: 30 * 24 * 60 * 60 * 1000,
    CACHE_MAX_ENTRIES: 150,

    // Gemini 單次請求上限 20MB；大綱 PDF 實測約 100~200KB，這只是保險
    MAX_PDF_BYTES: 15 * 1024 * 1024,

    // 摘要的固定欄位。UI 依這個順序畫卡片，模型也依這個 schema 回 JSON。
    SCHEMA: {
        type: 'OBJECT',
        properties: {
            overview: {
                type: 'STRING',
                description: '2-3 sentences: what the course covers and what students will be able to do after taking it.'
            },
            grading: {
                type: 'ARRAY',
                description: 'Each graded component with its weight exactly as stated in the syllabus.',
                items: {
                    type: 'OBJECT',
                    properties: {
                        item: { type: 'STRING', description: 'Component name, e.g. Midterm, Homework, Final project' },
                        weight: { type: 'STRING', description: 'Weight as stated, e.g. "30%" or "20-30%". Empty if not stated.' },
                        note: { type: 'STRING', description: 'Short detail: count, format, dates, drop-lowest rule. Empty if none.' }
                    },
                    required: ['item', 'weight', 'note'],
                    propertyOrdering: ['item', 'weight', 'note']
                }
            },
            gradingNotes: {
                type: 'STRING',
                description: 'Other grading rules: curve, pass conditions, bonus, penalties. Empty if none.'
            },
            assessments: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Homework / exams / projects / presentations: how many, format, timing (weeks or dates), open/closed book.'
            },
            materials: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Textbook(s) and reference books/resources. Keep titles and authors as written.'
            },
            prerequisites: {
                type: 'STRING',
                description: 'Required or recommended prior courses/knowledge. Empty if not mentioned.'
            },
            format: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Teaching method, language of instruction, attendance / roll-call policy, in-person or online, lab sessions.'
            },
            aiPolicy: {
                type: 'STRING',
                description: 'The course policy on using generative AI tools (ChatGPT, Copilot, etc.) for assignments, projects, or exams. Empty if not mentioned.'
            },
            misc: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Other practical details not covered above: course withdrawal (停修) rules, late submission policy, plagiarism policy, office hours, TA contact, course website/LMS, required software or hardware, fees, enrollment restrictions, field trips.'
            },
            tips: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: '2-4 short takeaways for a student deciding whether to take this course: expected workload, difficulty signals, who it suits. Must be grounded in the syllabus.'
            }
        },
        required: ['overview', 'grading', 'gradingNotes', 'assessments', 'materials', 'prerequisites', 'format', 'aiPolicy', 'misc', 'tips'],
        propertyOrdering: ['overview', 'grading', 'gradingNotes', 'assessments', 'materials', 'prerequisites', 'format', 'aiPolicy', 'misc', 'tips']
    },

    // 卡片標題依摘要語言切換；沒有對應語言就退回繁中
    SECTION_LABELS: {
        'zh-TW': {
            overview: '課程概要', grading: '評分方式', assessments: '作業與考試', materials: '教材與參考書',
            prerequisites: '先修要求', format: '上課方式與規定', aiPolicy: 'AI 使用限制', misc: '其他資訊',
            tips: '給選課者的提示', empty: '大綱未提及', sourcePdf: 'PDF 大綱', sourceText: '文字大綱',
            cached: '快取', disclaimer: 'AI 產生的內容可能有誤或遺漏，請以原始大綱為準。',
            gradingRest: '大綱未說明', gradingOverflow: '大綱所列配分合計超過 100%，圖中已按比例縮放：'
        },
        'en': {
            overview: 'Overview', grading: 'Grading', assessments: 'Assignments & Exams', materials: 'Textbooks & References',
            prerequisites: 'Prerequisites', format: 'Format & Rules', aiPolicy: 'AI Usage Policy', misc: 'Other Information',
            tips: 'Tips for Students', empty: 'Not mentioned in the syllabus', sourcePdf: 'PDF syllabus', sourceText: 'Text syllabus',
            cached: 'cached', disclaimer: 'AI-generated content may contain errors or omissions. Refer to the original syllabus.',
            gradingRest: 'Not specified', gradingOverflow: 'Listed weights add up to more than 100%; the bar is scaled:'
        },
        'ja': {
            overview: '授業概要', grading: '成績評価', assessments: '課題と試験', materials: '教科書・参考書',
            prerequisites: '履修条件', format: '授業形式と規則', aiPolicy: 'AI 利用ポリシー', misc: 'その他',
            tips: '履修のヒント', empty: 'シラバスに記載なし', sourcePdf: 'PDF シラバス', sourceText: 'テキスト',
            cached: 'キャッシュ', disclaimer: 'AI が生成した内容には誤りや漏れがある可能性があります。原本のシラバスを確認してください。',
            gradingRest: '記載なし', gradingOverflow: '配分の合計が 100% を超えるため、比率で縮小表示：'
        },
        'ko': {
            overview: '강의 개요', grading: '성적 평가', assessments: '과제 및 시험', materials: '교재 및 참고자료',
            prerequisites: '선수 과목', format: '수업 방식 및 규정', aiPolicy: 'AI 사용 정책', misc: '기타 정보',
            tips: '수강 팁', empty: '강의계획서에 언급 없음', sourcePdf: 'PDF 강의계획서', sourceText: '텍스트',
            cached: '캐시', disclaimer: 'AI가 생성한 내용은 오류나 누락이 있을 수 있습니다. 원본 강의계획서를 확인하세요.',
            gradingRest: '명시되지 않음', gradingOverflow: '비중 합계가 100%를 초과하여 비율로 축소 표시:'
        }
    },

    labels(languageValue) {
        return this.SECTION_LABELS[languageValue] || this.SECTION_LABELS['zh-TW'];
    },

    // 科號在不同頁面的空白數不一樣（"11510CS  210400" / "11510CS 210400"），快取一律去空白
    normalizeId(id) {
        return String(id || '').replace(/\s+/g, '');
    },

    // --- 抓大綱 ---------------------------------------------------------

    syllabusUrl(cKey) {
        const token = NthuGradeStats.getAcixstore();
        if (!token) throw new Error('找不到登入憑證（ACIXSTORE），請重新整理選課頁面。');
        return `${this.SYLLABUS_URL}?ACIXSTORE=${encodeURIComponent(token)}&c_key=${encodeURIComponent(cKey)}`;
    },

    async fetchSyllabusDoc(cKey) {
        let response;
        try {
            response = await fetch(this.syllabusUrl(cKey));
        } catch (error) {
            throw new Error('連線課程大綱頁失敗，請確認網路狀態。');
        }
        if (!response.ok) throw new Error(`讀取課程大綱失敗（HTTP ${response.status}）。`);
        const html = new TextDecoder('big5').decode(await response.arrayBuffer());
        return new DOMParser().parseFromString(html, 'text/html');
    },

    // 把儲存格內容轉成保留分段的純文字：<br> 是唯一的段落標記
    cellText(cell) {
        if (!cell) return '';
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        clone.querySelectorAll('script, style').forEach(node => node.remove());
        return clone.textContent
            .split('\n')
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    /**
     * 解析大綱頁。
     * 上半段是「標籤格｜內容格」交錯的課程資訊表，直接照標籤找右邊那格；
     * 下半段的「課程簡述」「課程大綱」各是一列標題、下一列內容。
     *
     * @param {Document} doc - 大綱頁（fetch 回來的，或在大綱頁上直接用 document）
     * @returns {{ id, name, nameEn, teacher, time, room, credit, size,
     *            description, outline, pdfUrl, keywords }}
     */
    parseSyllabusDoc(doc) {
        const info = { id: '', name: '', nameEn: '', teacher: '', time: '', room: '', credit: '', size: '' };
        const labelMap = [
            ['科號', 'id'], ['中文名稱', 'name'], ['英文名稱', 'nameEn'], ['任課教師', 'teacher'],
            ['上課時間', 'time'], ['上課教室', 'room'], ['學分', 'credit'], ['人數限制', 'size']
        ];
        const cells = [...doc.querySelectorAll('td')];
        cells.forEach((cell, index) => {
            const label = cell.textContent.replace(/\s+/g, '');
            const entry = labelMap.find(([prefix]) => label.startsWith(prefix));
            if (!entry || info[entry[1]]) return;
            const value = cells[index + 1];
            if (value) info[entry[1]] = this.cellText(value).replace(/\n?more information\s*$/i, '').trim();
        });

        // 標題列的下一列就是內容
        let description = '';
        let outlineCell = null;
        const rows = [...doc.querySelectorAll('tr')];
        rows.forEach((row, index) => {
            const text = row.textContent.replace(/\s+/g, '');
            const next = rows[index + 1];
            if (!next) return;
            if (!description && text.startsWith('課程簡述')) {
                description = this.cellText(next.cells[0]);
            } else if (!outlineCell && text.startsWith('課程大綱')) {
                outlineCell = next.cells[0];
            }
        });

        let pdfUrl = null;
        let outline = '';
        if (outlineCell) {
            const pdfLink = [...outlineCell.querySelectorAll('a[href]')]
                .find(a => /\.pdf(\?|$)/i.test(a.getAttribute('href')));
            if (pdfLink) {
                pdfUrl = new URL(pdfLink.getAttribute('href'), this.SYLLABUS_URL).href;
            }
            outline = this.cellText(outlineCell);
            if (pdfUrl) {
                // PDF 型那格只剩下載說明，對摘要沒用，濾掉
                outline = outline
                    .split('\n')
                    .filter(line => !/觀看上傳之檔案|另存目標|read pdf file|save the file/i.test(line))
                    .join('\n')
                    .trim();
            }
        }

        return { ...info, description, outline, pdfUrl };
    },

    async loadPdfBase64(url) {
        let response;
        try {
            response = await fetch(url);
        } catch (error) {
            throw new Error('下載大綱 PDF 失敗，請確認網路狀態。');
        }
        if (!response.ok) throw new Error(`下載大綱 PDF 失敗（HTTP ${response.status}）。`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > this.MAX_PDF_BYTES) {
            throw new Error('大綱 PDF 太大，超過可以送給 Gemini 的上限。');
        }
        const bytes = new Uint8Array(buffer);
        // 校務系統偶爾會回 HTML（例如登入逾時），先看檔頭
        if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
            throw new Error('大綱 PDF 內容異常，可能是登入逾時，請重新整理頁面。');
        }
        // 分段 btoa：一次餵整份 apply 會爆掉引數上限
        let binary = '';
        const chunk = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunk));
        }
        return btoa(binary);
    },

    // --- 組 prompt ---------------------------------------------------------

    systemInstruction(language) {
        return [
            'You help students at National Tsing Hua University (NTHU, Taiwan) decide whether to take a course.',
            'You will be given one course syllabus as text and/or an attached PDF. Extract the information into the given JSON schema.',
            '',
            'Rules:',
            `- Write EVERY output string in ${language.prompt}, regardless of the language of the syllabus. This is mandatory even if the syllabus is entirely in another language.`,
            '- Keep proper nouns as written: book titles, author names, software names, course codes. Everything else, including names of assignments, exams and grading components, must be translated into the output language.',
            '- Use ONLY information that appears in the syllabus. If something is not mentioned, return an empty string or empty array for that field. Never guess or fill in typical values.',
            '- Be concise. Use short phrases or single sentences per item. No markdown, no bullet characters, no field names inside values.',
            '- grading: one entry per graded component, weight copied exactly as stated (e.g. "30%"). If the syllabus lists components without weights, still list every component and leave weight empty. If the syllabus gives an alternative scheme, describe it in gradingNotes.',
            '- aiPolicy: only the rules about using generative AI tools. If the syllabus says nothing about AI, leave it empty.',
            '- misc: practical details a student cares about that do not fit other fields, especially course withdrawal (停修) rules, late policy, academic honesty, office hours, course website.',
            '- tips: 2-4 concrete takeaways grounded in the syllabus (workload, difficulty, who it suits). Do not repeat the overview.'
        ].join('\n');
    },

    /**
     * 組 generateContent 的 body。
     * 課程基本資料與課程簡述一律以文字附上；大綱本文是文字就直接接在後面，
     * 是 PDF 就另外用 inlineData 附上。
     */
    buildRequestBody(parsed, pdfBase64, language) {
        const header = [
            `Course number: ${parsed.id}`,
            `Course title: ${parsed.name}${parsed.nameEn ? ` (${parsed.nameEn})` : ''}`,
            `Instructor: ${parsed.teacher}`,
            `Credits: ${parsed.credit}`,
            `Time: ${parsed.time}`,
            `Room: ${parsed.room}`,
            '',
            '== Brief course description ==',
            parsed.description || '(none)',
            '',
            pdfBase64 ? '== Keywords / notes on the syllabus page ==' : '== Syllabus ==',
            parsed.outline || '(none)'
        ].join('\n');

        const parts = [{ text: header }];
        if (pdfBase64) {
            parts.push({ text: '\n== Full syllabus (attached PDF) ==' });
            parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
        }

        return {
            systemInstruction: { parts: [{ text: this.systemInstruction(language) }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: this.SCHEMA,
                temperature: 0.2
            }
        };
    },

    // 從 API 回覆挖出 JSON 文字；被安全機制擋掉或截斷時給出看得懂的錯誤
    extractSummary(data) {
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) throw new Error(`Gemini 拒絕處理這份大綱（${blockReason}）。`);

        const candidate = data?.candidates?.[0];
        const text = (candidate?.content?.parts || [])
            .map(part => part.text || '')
            .join('')
            .trim();
        if (!text) {
            const reason = candidate?.finishReason;
            throw new Error(reason ? `Gemini 沒有回傳內容（${reason}）。` : 'Gemini 沒有回傳內容。');
        }

        // JSON mode 理論上不會包 code fence，保險起見還是剝一次
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        let summary;
        try {
            summary = JSON.parse(cleaned);
        } catch (error) {
            if (candidate?.finishReason === 'MAX_TOKENS') {
                throw new Error('Gemini 回覆被截斷，請按「重新產生」再試一次。');
            }
            throw new Error('Gemini 回覆不是有效的 JSON，請再試一次。');
        }
        return this.normalizeSummary(summary);
    },

    // 補齊缺欄位、統一型別，UI 才不用到處判斷 undefined
    normalizeSummary(raw) {
        const str = (value) => (typeof value === 'string' ? value.trim() : '');
        const list = (value) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);
        return {
            overview: str(raw.overview),
            grading: Array.isArray(raw.grading)
                ? raw.grading
                    .filter(entry => entry && typeof entry === 'object')
                    .map(entry => ({ item: str(entry.item), weight: str(entry.weight), note: str(entry.note) }))
                    .filter(entry => entry.item)
                : [],
            gradingNotes: str(raw.gradingNotes),
            assessments: list(raw.assessments),
            materials: list(raw.materials),
            prerequisites: str(raw.prerequisites),
            format: list(raw.format),
            aiPolicy: str(raw.aiPolicy),
            misc: list(raw.misc),
            tips: list(raw.tips)
        };
    },

    // --- 快取 ---------------------------------------------------------

    async readCache() {
        try {
            const stored = await chrome.storage.local.get(this.CACHE_KEY);
            return stored[this.CACHE_KEY] || {};
        } catch (error) {
            console.error('讀取 AI 摘要快取失敗：', error);
            return {};
        }
    },

    async writeCache(courseId, entry) {
        const cache = await this.readCache();
        cache[courseId] = entry;
        // 超量就丟最舊的
        const ids = Object.keys(cache);
        if (ids.length > this.CACHE_MAX_ENTRIES) {
            ids.sort((a, b) => (cache[a].generatedAt || 0) - (cache[b].generatedAt || 0))
                .slice(0, ids.length - this.CACHE_MAX_ENTRIES)
                .forEach(id => { delete cache[id]; });
        }
        try {
            await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
        } catch (error) {
            console.error('寫入 AI 摘要快取失敗：', error);
        }
    },

    /**
     * 取快取。語言或模型換了就當沒有，讓使用者拿到的永遠是目前設定產生的結果。
     */
    async getCached(courseId, language, model) {
        const entry = (await this.readCache())[courseId];
        if (!entry || !entry.summary) return null;
        if (entry.language !== language || entry.model !== model) return null;
        if (Date.now() - (entry.generatedAt || 0) > this.CACHE_TTL_MS) return null;
        return entry;
    },

    // --- 主流程 ---------------------------------------------------------

    /**
     * 產生（或從快取取出）一門課的摘要。
     *
     * @param {Object} options
     * @param {string} options.courseId - 科號，快取用
     * @param {string} [options.cKey] - 大綱頁的 c_key（即 syllabusActionArgs[0]）；有 doc 時可省略
     * @param {Document} [options.doc] - 已經在大綱頁上時直接傳 document，省一次連線
     * @param {boolean} [options.force] - 略過快取重新產生
     * @param {Function} [options.onProgress] - 階段回呼：'fetch' | 'pdf' | 'generate'
     * @returns {Promise<Object>} { summary, model, language, source, generatedAt, fromCache, course }
     */
    async summarize({ courseId, cKey, doc, force = false, onProgress = () => {} }) {
        const prefs = await NthuCoursePrefs.load();
        if (!prefs.geminiApiKey) throw new Error('NO_API_KEY');
        const model = NthuCoursePrefs.resolveModel(prefs);
        const language = NthuCoursePrefs.resolveLanguage(prefs);
        const id = this.normalizeId(courseId);

        if (!force) {
            const cached = await this.getCached(id, language.value, model);
            if (cached) return { ...cached, fromCache: true };
        }

        onProgress('fetch');
        const parsed = this.parseSyllabusDoc(doc || await this.fetchSyllabusDoc(cKey));
        if (!parsed.id) {
            throw new Error('讀不到課程大綱內容，可能是登入逾時，請重新整理選課頁面。');
        }
        if (!parsed.pdfUrl && !parsed.outline && !parsed.description) {
            throw new Error('這門課的大綱是空的，沒有內容可以整理。');
        }

        let pdfBase64 = null;
        if (parsed.pdfUrl) {
            onProgress('pdf');
            pdfBase64 = await this.loadPdfBase64(parsed.pdfUrl);
        }

        onProgress('generate');
        const body = this.buildRequestBody(parsed, pdfBase64, language);
        let response;
        try {
            response = await chrome.runtime.sendMessage({ type: 'GEMINI_GENERATE', payload: { model, body } });
        } catch (error) {
            // 擴充功能剛更新／重新載入時，舊的內容腳本會連不上 background
            throw new Error('擴充功能背景程式沒有回應，請重新整理頁面後再試。');
        }
        if (!response) throw new Error('擴充功能背景程式沒有回應，請重新整理頁面後再試。');
        if (!response.ok) throw new Error(response.error || 'Gemini 呼叫失敗。');

        const summary = this.extractSummary(response.result);
        const entry = {
            summary,
            model,
            language: language.value,
            source: pdfBase64 ? 'pdf' : 'text',
            generatedAt: Date.now(),
            course: { id: parsed.id, name: parsed.name, teacher: parsed.teacher }
        };
        await this.writeCache(id, entry);
        return { ...entry, fromCache: false };
    }
};
