// scripts/modal.js
// 負責建立與管理互動視窗

const NthuCourseModal = {
    show(url, originRect) {
        this.close(true); // 立即關閉任何已存在的 modal

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.innerHTML = `<button id="nthu-helper-modal-close">&times;</button><iframe src="${url}"></iframe>`;
        
        // --- 動畫核心邏輯 ---
        if (originRect) {
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            // 設定動畫的原點為按鈕中心
            modalContent.style.transformOrigin = `${originX}px ${originY}px`;
        }
        modalOverlay.classList.add('opening'); // 觸發開啟動畫
        // --- 結束 ---

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
    },

    close(immediately = false) {
        const modalOverlay = document.getElementById('nthu-helper-modal-overlay');
        if (modalOverlay) {
            if (immediately) {
                modalOverlay.remove();
                return;
            }
            modalOverlay.classList.remove('opening');
            modalOverlay.classList.add('closing');
            
            // 動畫結束後移除元素
            modalOverlay.addEventListener('animationend', () => {
                modalOverlay.remove();
            }, { once: true });
        }
    },
    /**
     * 【新增】顯示已儲存課程的互動視窗
     * @param {Array<Object>} savedCourses - 已儲存的課程物件陣列
     * @param {Function} onRemoveCallback - 當課程被移除時要執行的回呼函數，
     *        參數為課程科號；傳入 null 表示清空全部。
     *        （不使用陣列索引，因為移除一筆後其餘列的索引會失效。）
     */
    showSavedCoursesModal(savedCourses, onRemoveCallback, originRect) {
        this.close(true);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.classList.add('saved-courses-modal');
        if (originRect) {
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            modalContent.style.transformOrigin = `${originX}px ${originY}px`;
        }
        modalOverlay.classList.add('opening');
        
        const dayMap = { 1: 'M', 2: 'T', 3: 'W', 4: 'R', 5: 'F', 6: 'S', 7: 'U' };

        const tableRows = savedCourses.length === 0 
            ? '<tr><td colspan="8" class="no-saved-courses">尚未暫存任何課程</td></tr>'
            : savedCourses.map((course) => {
                const formattedTime = (course.time || []).map(t => `${dayMap[t.day] || '?'}${t.slot}`).join(' ');
                // 一律以科號當識別碼，避免移除某一列後其餘列的索引錯位而刪到別的課
                const courseId = course.id;
                let addActionCellHTML = '';
                // 根據課程類型決定是產生「志願序輸入框+按鈕」還是單純的「按鈕」
                if (course.addActionArgs) {
                    if (course.isGeInput) {
                        addActionCellHTML = `<input type="text" placeholder="志願序" class="ge-priority-input" data-course-id="${courseId}"><button class="btn2 add-course-btn" data-action="add" data-course-id="${courseId}">加 Add</button>`;
                    } else {
                        addActionCellHTML = `<button class="btn2 add-course-btn" data-action="add" data-course-id="${courseId}">加 ADD</button>`;
                    }
                }
                const syllabusActionCellHTML = course.syllabusActionArgs
                    ? `<button class="btn2 syllabus-btn" data-action="syllabus" data-course-id="${courseId}">大綱</button>`
                      + `<button class="btn2 ai-btn" data-action="ai" data-course-id="${courseId}" title="AI 統整課程大綱">${NthuIcons.svg('sparkle', 12)}AI</button>`
                    : '';

                return `
                    <tr data-course-id="${courseId}">
                        <td>${courseId}</td>
                        <td>${course.name}</td>
                        <td>${course.teacher.split('\n')[0]}</td>
                        <td>${course.credit}</td>
                        <td>${formattedTime}</td>
                        <td class="action-cell">${addActionCellHTML}</td>
                        <td class="action-cell">${syllabusActionCellHTML}</td>
                        <td><button class="remove-btn" data-course-id="${courseId}">移除</button></td>
                    </tr>
                `;
            }).join('');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>已暫存課程清單</h2>
                <div class="betage-label">Beta</div>
                <div class="warning-text">※ 加選功能仍在測試中，可能會有錯誤。</div>
                <button class="delete-all-btn" id="nthu-helper-delete-all-saved-courses">清空全部</button>
                <button id="nthu-helper-modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <table class="saved-courses-table">
                    <thead><tr><th>科號</th><th>課程名稱</th><th>教師</th><th>學分</th><th>時間</th><th>加選</th><th>大綱</th><th>操作</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // 移除按鈕的事件委派
        modalContent.querySelector('tbody').addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-btn')) {
                onRemoveCallback(event.target.dataset.courseId);
            }
        });
        modalContent.querySelector('.delete-all-btn').addEventListener('click', () => {
            onRemoveCallback(null); // 傳 null 表示清空全部
        });
        
        // 綁定關閉事件
        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
        
    },

    /**
     * 顯示「偏好設定」互動視窗
     * @param {Object} prefs - 目前的設定值（NthuCoursePrefs.load() 的結果）
     * @param {Function} onChangeCallback - 設定變動時的回呼，參數為 (key, value, committed)。
     *        committed 為 false 代表這是拖曳滑桿過程中的即時預覽，不應寫入儲存；
     *        true 代表使用者已經定案（勾選框切換、滑桿放開）。
     * @param {DOMRect} originRect - 觸發按鈕的位置，用於展開動畫的原點
     */
    showPreferencesModal(prefs, onChangeCallback, originRect) {
        this.close(true);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.classList.add('preferences-modal');
        if (originRect) {
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            modalContent.style.transformOrigin = `${originX}px ${originY}px`;
        }
        modalOverlay.classList.add('opening');

        const rows = NthuCoursePrefs.ITEMS.map(item => {
            const text = `
                <div class="preference-text">
                    <div class="preference-label">${item.label}</div>
                    <div class="preference-hint">${item.hint}</div>
                </div>`;

            // 分組標題：只是視覺分隔，沒有對應的設定值
            if (item.type === 'heading') {
                return `<div class="preference-heading">${text}</div>`;
            }

            // 文字／機密輸入：離開欄位或按 Enter 才儲存（change 事件）。
            // 機密欄位（API key）永遠不把已存的值放進 DOM：這個視窗掛在 ccxp 的頁面上，
            // 頁面 script 讀得到 input.value。已設定時欄位留空、placeholder 只露後 4 碼，
            // 使用者貼新值就換掉，要清掉用旁邊的按鈕。不用 type="password"，
            // Chrome 看到就會跳密碼管理員要幫你存；另加標記讓第三方管理員略過。
            if (item.type === 'text' || item.type === 'secret') {
                const isSecret = item.type === 'secret';
                const hasSecret = isSecret && !!prefs[item.key];
                const clear = isSecret
                    ? `<button type="button" class="preference-clear" title="清除已存的 key" ${hasSecret ? '' : 'hidden'}>${NthuIcons.svg('trash', 15)}</button>`
                    : '';
                const placeholder = hasSecret
                    ? this.describeSecret(prefs[item.key])
                    : (item.placeholder || '');
                return `
                    <div class="preference-item">
                        ${text}
                        <div class="preference-control">
                            <input type="text" data-pref-key="${item.key}"
                                   value="${isSecret ? '' : this.escapeHtml(prefs[item.key] || '')}"
                                   placeholder="${this.escapeHtml(placeholder)}"
                                   autocomplete="off" spellcheck="false"
                                   ${isSecret ? `data-secret data-secret-placeholder="${this.escapeHtml(item.placeholder || '')}" data-lpignore="true" data-1p-ignore data-bwignore` : ''}>
                            ${clear}
                        </div>
                    </div>`;
            }

            if (item.type === 'select') {
                const options = (NthuCoursePrefs[item.options] || [])
                    .map(option => `<option value="${this.escapeHtml(option.value)}" ${prefs[item.key] === option.value ? 'selected' : ''}>${this.escapeHtml(option.label)}</option>`)
                    .join('');
                return `
                    <div class="preference-item">
                        ${text}
                        <div class="preference-control">
                            <select data-pref-key="${item.key}">${options}</select>
                        </div>
                    </div>`;
            }

            // 滑桿型項目占一整列，滑桿在說明文字下方另起一行
            if (item.type === 'range') {
                return `
                    <div class="preference-item preference-item-column">
                        ${text}
                        <div class="preference-range">
                            <span>${item.minLabel}</span>
                            <input type="range" data-pref-key="${item.key}"
                                   min="${item.min}" max="${item.max}" step="${item.step}"
                                   value="${prefs[item.key]}">
                            <span>${item.maxLabel}</span>
                        </div>
                    </div>`;
            }

            return `
                <div class="preference-item">
                    ${text}
                    <label class="switch">
                        <input type="checkbox" data-pref-key="${item.key}" ${prefs[item.key] ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>`;
        }).join('');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>偏好設定</h2>
                <div class="preferences-note">※ 設定的是「預設值」，下次開啟選課頁時套用；不會改變你目前頁面上的篩選狀態。</div>
                <button id="nthu-helper-modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="preferences-list">${rows}</div>
            </div>
        `;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        const list = modalContent.querySelector('.preferences-list');
        const readValue = (input) => {
            if (input.type === 'checkbox') return input.checked;
            if (input.type === 'range') return Number(input.value);
            return input.value.trim();
        };

        // 機密欄位：清除按鈕直接存空字串，並把 placeholder 換回未設定的提示
        list.addEventListener('click', (event) => {
            const button = event.target.closest('.preference-clear');
            if (!button) return;
            const input = button.parentElement.querySelector('input');
            input.value = '';
            input.placeholder = input.dataset.secretPlaceholder;
            button.hidden = true;
            onChangeCallback(input.dataset.prefKey, '', true);
        });

        // input：滑桿拖曳中的即時預覽（不寫入儲存）
        list.addEventListener('input', (event) => {
            const input = event.target;
            if (input.type !== 'range' || !input.dataset.prefKey) return;
            onChangeCallback(input.dataset.prefKey, readValue(input), false);
        });
        // change：勾選框切換、或滑桿放開後才真正儲存
        list.addEventListener('change', (event) => {
            const input = event.target;
            if (!['INPUT', 'SELECT'].includes(input.tagName) || !input.dataset.prefKey) return;
            const value = readValue(input);
            // 機密欄位：空值不算「清除」（只是點進去又離開），清除要按旁邊的按鈕；
            // 存好之後立刻把欄位清空，key 不留在 DOM 裡
            if ('secret' in input.dataset) {
                if (!value) return;
                input.value = '';
                input.placeholder = this.describeSecret(value);
                input.parentElement.querySelector('.preference-clear').hidden = false;
            }
            onChangeCallback(input.dataset.prefKey, value, true);
        });
        // 文字欄位按 Enter 直接定案，不必先點到別處
        list.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'range') {
                event.preventDefault();
                event.target.blur();
            }
        });

        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
    },

    // 已設定的 API key 只露後 4 碼，讓使用者確認是哪一把、又不把整串放進頁面
    describeSecret(value) {
        return `已設定 …${String(value).slice(-4)}（貼上新值可更換）`;
    },

    // 表格內容來自伺服器回傳的 HTML，插進 innerHTML 前一律逃脫
    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    },

    /**
     * 顯示「歷年成績平均值／標準差」互動視窗。
     *
     * 分成兩段：show 只建一次外框與控制項，之後查詢的每個階段
     * （查詢中／失敗／有結果）都由 renderGradeStatsBody 重畫內容區，
     * 這樣切換學期時視窗不會整個閃一下重開。
     *
     * @param {Object} state - 由 content.js 持有的查詢狀態，欄位見 renderGradeStatsBody
     * @param {Function} onChange - 使用者改變查詢條件時的回呼，參數為要套用的 patch 物件
     * @param {DOMRect} originRect - 觸發按鈕的位置，用於展開動畫的原點
     */
    showGradeStatsModal(state, onChange, originRect) {
        this.close(true);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.classList.add('grade-stats-modal');
        if (originRect) {
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            modalContent.style.transformOrigin = `${originX}px ${originY}px`;
        }
        modalOverlay.classList.add('opening');

        const course = state.course || {};
        const subtitle = [course.id, course.name, (course.teacher || '').split('\n')[0]]
            .filter(Boolean)
            .join('　');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>歷年成績分佈</h2>
                <div class="grade-stats-subtitle">${this.escapeHtml(subtitle)}</div>
                <button id="nthu-helper-modal-close">&times;</button>
            </div>
            <div class="grade-stats-controls">
                <label>學期
                    <select class="grade-stats-term"></select>
                </label>
                <label>查詢方式
                    <select class="grade-stats-mode">
                        <option value="course">依課程名稱</option>
                        <option value="teacher">依教師姓名</option>
                    </select>
                </label>
                <input type="text" class="grade-stats-keyword" placeholder="查詢關鍵字">
                <button type="button" class="btn grade-stats-search">查詢</button>
            </div>
            <div class="modal-body"></div>
        `;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        const modeSelect = modalContent.querySelector('.grade-stats-mode');
        const keywordInput = modalContent.querySelector('.grade-stats-keyword');
        const termSelect = modalContent.querySelector('.grade-stats-term');

        const submit = () => onChange({
            term: termSelect.value,
            mode: modeSelect.value,
            keyword: keywordInput.value
        });

        // 切換「依課名／依教師」時把關鍵字換成對應的預設值，
        // 省得使用者每次都要自己把課名改成老師名字
        modeSelect.addEventListener('change', () => {
            keywordInput.value = modeSelect.value === 'teacher'
                ? (course.teacher || '').split('\n')[0].trim()
                : NthuGradeStats.searchableCourseName(course.name);
            submit();
        });
        termSelect.addEventListener('change', submit);
        modalContent.querySelector('.grade-stats-search').addEventListener('click', submit);
        keywordInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
        });

        this.renderGradeStatsControls(state);
        this.renderGradeStatsBody(state);

        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
    },

    // 學期選單是等伺服器回覆才填的，所以跟內容區分開來更新
    renderGradeStatsControls(state) {
        const modalContent = document.getElementById('nthu-helper-modal-content');
        if (!modalContent || !modalContent.classList.contains('grade-stats-modal')) return;

        const termSelect = modalContent.querySelector('.grade-stats-term');
        termSelect.innerHTML = state.terms
            .map(term => `<option value="${this.escapeHtml(term.value)}">${this.escapeHtml(term.label)}</option>`)
            .join('');
        termSelect.value = state.term;

        modalContent.querySelector('.grade-stats-mode').value = state.mode;
        modalContent.querySelector('.grade-stats-keyword').value = state.keyword;
    },

    /**
     * 重畫結果區。
     * @param {Object} state - { loading, error, result, matched, mode }
     *        result 為 NthuGradeStats.extractResult 的輸出，matched 為要高亮的列索引集合
     */
    renderGradeStatsBody(state) {
        const modalContent = document.getElementById('nthu-helper-modal-content');
        if (!modalContent || !modalContent.classList.contains('grade-stats-modal')) return;
        const body = modalContent.querySelector('.modal-body');

        modalContent.querySelectorAll('.grade-stats-controls select, .grade-stats-controls button')
            .forEach(control => { control.disabled = !!state.loading; });

        if (state.loading) {
            body.innerHTML = '<div class="grade-stats-message">查詢中…</div>';
            return;
        }
        if (state.error) {
            body.innerHTML = `<div class="grade-stats-message error">${this.escapeHtml(state.error)}</div>`;
            return;
        }

        const result = state.result;
        if (!result || !result.rows.length) {
            body.innerHTML = '<div class="grade-stats-message">這個學期查不到符合的成績資料。</div>';
            return;
        }

        const matched = state.matched || new Set();
        // 課名／教師欄原本是用 <br> 分中英文，解析時換成了換行，這裡還原
        const cellHtml = (value) => this.escapeHtml(value).replace(/\n/g, '<br>');

        // 成績分等級制與百分制兩組，同一學期通常只填其中一組，另一組整欄都是空的。
        // 空欄留著只會把左邊的科號／課名／教師擠掉，所以整欄沒值就不顯示。
        // 這裡只動顯示，result.rows 本身不重新編號，matched 的列索引才不會跑掉。
        const identityColumns = new Set(Object.values(result.columnIndexes));
        const shown = result.headers
            .map((_, index) => index)
            .filter(index => identityColumns.has(index)
                || result.rows.some(cells => (cells[index] || '').trim() !== ''));

        // 數字欄位寬度固定且置中，剩下的寬度全留給課程名稱
        const columnClass = (text) => {
            if (/科號/.test(text)) return 'col-id';
            if (/名稱/.test(text)) return 'col-name';
            if (/教師|教授/.test(text)) return 'col-teacher';
            if (/人數/.test(text)) return 'col-count';
            if (/平均|標準差/.test(text)) return 'col-score';
            return '';
        };
        const classes = shown.map(index => columnClass(result.headers[index]));
        const attr = (className) => (className ? ` class="${className}"` : '');

        const colsHtml = classes.map(className => `<col${attr(className)}>`).join('');
        const headerHtml = shown
            .map((index, position) => `<th${attr(classes[position])}>${this.escapeHtml(result.headers[index])}</th>`)
            .join('');
        const rowsHtml = result.rows.map((cells, index) => {
            const className = matched.has(index) ? ' class="grade-stats-match"' : '';
            const cellsHtml = shown
                .map((column, position) => `<td${attr(classes[position])}>${cellHtml(cells[column] || '')}</td>`)
                .join('');
            return `<tr${className}>${cellsHtml}</tr>`;
        }).join('');

        const hint = matched.size
            ? `共 ${result.rows.length} 筆，已標出這門課的 ${matched.size} 筆紀錄。`
            : `共 ${result.rows.length} 筆，這個學期沒有比對到同一位教師的紀錄。`;

        // 認得出課名欄時才固定欄寬，由它吸收剩下的空間；
        // 認不出來就交回瀏覽器自動配寬，總比每欄硬切成等寬好
        const tableClass = classes.includes('col-name')
            ? 'grade-stats-table fixed-columns'
            : 'grade-stats-table';

        body.innerHTML = `
            <div class="grade-stats-hint">${this.escapeHtml(hint)}</div>
            <table class="${tableClass}">
                <colgroup>${colsHtml}</colgroup>
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        // 命中的列可能排在很後面，直接捲到第一筆。
        // 這裡自己算 scrollTop 而不用 scrollIntoView，後者會連帶把底下的選課頁面也捲走。
        const firstMatch = body.querySelector('.grade-stats-match');
        if (firstMatch) {
            body.scrollTop += firstMatch.getBoundingClientRect().top
                - body.getBoundingClientRect().top
                - body.clientHeight / 2;
        }
    },

    /**
     * 顯示「AI 大綱統整」互動視窗。
     * 跟成績視窗一樣：外框只建一次，內容區交給 renderSyllabusAIBody 依狀態重畫。
     *
     * @param {Object} state - { course, status, stage, error, result }，見 renderSyllabusAIBody
     * @param {Object} handlers - { onRegenerate, onOpenSyllabus, onOpenPrefs }
     * @param {DOMRect} originRect - 觸發按鈕的位置，用於展開動畫的原點
     */
    showSyllabusAIModal(state, handlers, originRect) {
        this.close(true);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.classList.add('syllabus-ai-modal');
        if (originRect) {
            const originX = originRect.left + originRect.width / 2;
            const originY = originRect.top + originRect.height / 2;
            modalContent.style.transformOrigin = `${originX}px ${originY}px`;
        }
        modalOverlay.classList.add('opening');

        const course = state.course || {};
        const subtitle = [course.id, course.name, (course.teacher || '').split('\n')[0]]
            .filter(Boolean)
            .join('　');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>${NthuIcons.svg('sparkle', 18)}AI 大綱統整</h2>
                <div class="syllabus-ai-subtitle">${this.escapeHtml(subtitle)}</div>
                <div class="syllabus-ai-header-actions">
                    ${handlers.onOpenSyllabus ? '<button type="button" class="syllabus-ai-action syllabus-ai-open">開啟原始大綱</button>' : ''}
                    <button type="button" class="syllabus-ai-action syllabus-ai-regenerate">重新產生</button>
                </div>
                <button id="nthu-helper-modal-close">&times;</button>
            </div>
            <div class="modal-body syllabus-ai-body"></div>
        `;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        const openButton = modalContent.querySelector('.syllabus-ai-open');
        if (openButton) openButton.addEventListener('click', () => handlers.onOpenSyllabus());
        modalContent.querySelector('.syllabus-ai-header-actions .syllabus-ai-regenerate')
            .addEventListener('click', () => handlers.onRegenerate());
        // 內容區重畫出來的按鈕（前往偏好設定、產生摘要）用事件委派接
        modalContent.querySelector('.syllabus-ai-body').addEventListener('click', (event) => {
            if (event.target.closest('.syllabus-ai-go-prefs') && handlers.onOpenPrefs) {
                handlers.onOpenPrefs(event.target.getBoundingClientRect());
            } else if (event.target.closest('.syllabus-ai-regenerate')) {
                handlers.onRegenerate();
            }
        });

        this.renderSyllabusAIBody(state, modalContent.querySelector('.syllabus-ai-body'));

        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
    },

    /**
     * 重畫 AI 摘要的內容區。大綱頁上的內嵌面板也用這個函式，所以容器由呼叫端傳入。
     *
     * @param {Object} state
     *        status: 'idle' | 'loading' | 'error' | 'done'
     *        stage:  'fetch' | 'pdf' | 'generate'（loading 時的階段）
     *        error:  Error 或字串；訊息為 'NO_API_KEY' 時顯示設定提示
     *        result: NthuSyllabusAI.summarize 的回傳值
     * @param {HTMLElement} [container] - 預設找目前 modal 內的 .syllabus-ai-body
     */
    renderSyllabusAIBody(state, container) {
        const body = container
            || document.querySelector('#nthu-helper-modal-content.syllabus-ai-modal .syllabus-ai-body');
        if (!body) return;

        // 外框（modal 或內嵌面板）標題列的「重新產生」，產生中先鎖住
        const frame = body.closest('.syllabus-ai-modal, .nthu-helper-syllabus-ai-panel');
        if (frame) {
            frame.querySelectorAll('.syllabus-ai-regenerate')
                .forEach(button => { button.disabled = state.status === 'loading'; });
        }

        if (state.status === 'idle') {
            body.innerHTML = `
                <div class="syllabus-ai-message">
                    <button type="button" class="syllabus-ai-action syllabus-ai-regenerate">${NthuIcons.svg('sparkle', 14)}產生 AI 摘要</button>
                    <div class="syllabus-ai-message-hint">會把大綱送給 Gemini 整理，使用你自己的 API 額度。</div>
                </div>`;
            return;
        }

        if (state.status === 'loading') {
            const stageText = {
                fetch: '讀取課程大綱中…',
                pdf: '下載大綱 PDF 中…',
                generate: 'Gemini 整理中，通常需要幾秒鐘…'
            }[state.stage] || '準備中…';
            body.innerHTML = `
                <div class="syllabus-ai-message">
                    <div class="syllabus-ai-spinner"></div>
                    <div>${stageText}</div>
                </div>`;
            return;
        }

        if (state.status === 'error') {
            const message = state.error?.message || String(state.error || '');
            if (message === 'NO_API_KEY') {
                body.innerHTML = `
                    <div class="syllabus-ai-message">
                        <div>還沒有設定 Google AI Studio API Key。</div>
                        <div class="syllabus-ai-message-hint">到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> 免費建立一組，貼到偏好設定後就能使用。</div>
                        <button type="button" class="syllabus-ai-action syllabus-ai-go-prefs">前往偏好設定</button>
                    </div>`;
                return;
            }
            body.innerHTML = `<div class="syllabus-ai-message error">${this.escapeHtml(message)}</div>`;
            return;
        }

        body.innerHTML = this.renderSyllabusSummary(state.result);
    },

    // 堆疊條各段的顏色：以擴充功能主色開頭，其餘挑明度接近、色相拉開的顏色，相鄰不混淆
    GRADING_COLORS: ['#3d32a0', '#4f8def', '#2e9e5b', '#e8a33d', '#d9536b', '#8e5cc9', '#26a6a0', '#a0774e'],

    // 把摘要 JSON 畫成卡片
    renderSyllabusSummary(result) {
        const summary = result.summary;
        const labels = NthuSyllabusAI.labels(result.language);
        const esc = (value) => this.escapeHtml(value);
        const empty = `<p class="syllabus-ai-empty">${esc(labels.empty)}</p>`;
        const paragraph = (text) => (text ? `<p>${esc(text)}</p>` : empty);
        const bullets = (items) => (items.length
            ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
            : empty);
        const card = (key, content, extraClass = '') => `
            <section class="syllabus-ai-card ${extraClass}">
                <h3>${esc(labels[key])}</h3>
                ${content}
            </section>`;

        // 評分方式：有百分比就畫成一條 100% 堆疊橫條 + 下方圖例清單；
        // 整份都沒有配分時退回單純的清單
        const percentOf = (weight) => {
            const match = (weight || '').match(/(\d+(?:\.\d+)?)\s*%/);
            return match ? Math.min(100, Number(match[1])) : null;
        };
        let gradingHtml = empty;
        if (summary.grading.some(entry => percentOf(entry.weight) !== null)) {
            const entries = summary.grading.map((entry, index) => ({
                ...entry,
                percent: percentOf(entry.weight),
                color: this.GRADING_COLORS[index % this.GRADING_COLORS.length]
            }));
            const total = entries.reduce((sum, entry) => sum + (entry.percent || 0), 0);
            // 大綱寫的配分有時加起來超過 100（含 bonus、或區間取了上限），按比例縮回一條；
            // 不足 100 的部分留一段灰色，代表大綱沒交代的比例
            const scale = total > 100 ? 100 / total : 1;
            const segments = entries
                .filter(entry => entry.percent)
                .map(entry => {
                    const width = entry.percent * scale;
                    // 太窄的段放不下文字，只留 tooltip
                    const label = width >= 9 ? esc(entry.weight) : '';
                    return `<span class="segment" style="width:${width}%;background:${entry.color}"
                                  title="${esc(entry.item)} ${esc(entry.weight)}">${label}</span>`;
                })
                .join('');
            const rest = total < 100
                ? `<span class="segment rest" style="width:${100 - total}%" title="${esc(labels.gradingRest)} ${100 - total}%"></span>`
                : '';
            const legend = entries.map(entry => `
                <div class="swatch" style="background:${entry.percent ? entry.color : 'transparent'};border-color:${entry.color}"></div>
                <div class="item">${esc(entry.item)}</div>
                <div class="weight">${esc(entry.weight || '—')}</div>
                <div class="note">${esc(entry.note)}</div>`).join('');
            const overflow = total > 100
                ? `<div class="syllabus-ai-stack-hint">${esc(labels.gradingOverflow)} ${total}%</div>`
                : '';
            gradingHtml = `
                <div class="syllabus-ai-stack">${segments}${rest}</div>
                ${overflow}
                <div class="syllabus-ai-grading">${legend}</div>`;
        } else if (summary.grading.length) {
            gradingHtml = bullets(summary.grading.map(entry => {
                const detail = [entry.weight, entry.note].filter(Boolean).join('，');
                return detail ? `${entry.item}（${detail}）` : entry.item;
            }));
        }
        if (summary.gradingNotes) {
            gradingHtml += `<p class="syllabus-ai-grading-notes">${esc(summary.gradingNotes)}</p>`;
        }

        const generatedAt = new Date(result.generatedAt);
        const pad = (n) => String(n).padStart(2, '0');
        const metaParts = [
            result.source === 'pdf' ? labels.sourcePdf : labels.sourceText,
            result.model,
            `${generatedAt.getMonth() + 1}/${generatedAt.getDate()} ${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`
        ];
        if (result.fromCache) metaParts.push(labels.cached);

        return `
            <div class="syllabus-ai-meta">${metaParts.map(part => `<span>${esc(part)}</span>`).join('')}</div>
            ${card('overview', paragraph(summary.overview))}
            ${card('grading', gradingHtml)}
            <div class="syllabus-ai-grid">
                ${card('assessments', bullets(summary.assessments))}
                ${card('format', bullets(summary.format))}
                ${card('materials', bullets(summary.materials))}
                ${card('prerequisites', paragraph(summary.prerequisites))}
            </div>
            ${card('aiPolicy', paragraph(summary.aiPolicy), 'ai-policy')}
            ${card('misc', bullets(summary.misc))}
            ${card('tips', bullets(summary.tips), 'tips')}
            <div class="syllabus-ai-disclaimer">${esc(labels.disclaimer)}</div>
        `;
    }
};