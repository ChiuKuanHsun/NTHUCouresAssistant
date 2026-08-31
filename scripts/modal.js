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
        const readValue = (input) => (input.type === 'checkbox' ? input.checked : Number(input.value));

        // input：滑桿拖曳中的即時預覽（不寫入儲存）
        list.addEventListener('input', (event) => {
            const input = event.target;
            if (input.type !== 'range' || !input.dataset.prefKey) return;
            onChangeCallback(input.dataset.prefKey, readValue(input), false);
        });
        // change：勾選框切換、或滑桿放開後才真正儲存
        list.addEventListener('change', (event) => {
            const input = event.target;
            if (input.tagName !== 'INPUT' || !input.dataset.prefKey) return;
            onChangeCallback(input.dataset.prefKey, readValue(input), true);
        });

        document.getElementById('nthu-helper-modal-close').addEventListener('click', () => this.close());
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) this.close();
        });
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
    }
};