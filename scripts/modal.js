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
    }
};