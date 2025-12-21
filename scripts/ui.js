// scripts/ui.js
// 負責建立並注入所有 UI 元素

const NthuCourseHelperUI = {
    // 建立篩選器面板
    createFilterUI(isGePage) {
        
        const container = document.createElement('div');
        // 預設為收合狀態
        container.style = 'margin-top: 10px;';
        container.className = 'nthu-helper-container collapsed';

        const geClashCheckbox = isGePage 
            ? `<label><input type="checkbox" id="nthu-helper-allow-ge-clash"> 允許通識衝堂</label>`
            : '';
        
        // 等待 DOM 插入後再設定勾選狀態
        setTimeout(() => {
            chrome.storage.sync.get(['allowGeClash'], (result) => {
            const allowGeClashCheckbox = document.getElementById('nthu-helper-allow-ge-clash');
            if (allowGeClashCheckbox && result.allowGeClash) {
                allowGeClashCheckbox.checked = true;
            }
            });
        }, 0);

        container.innerHTML = `
            <div class="nthu-helper-header">
                <h2>NTHU COURSE ASSISTANT</h2>
                <button id="nthu-helper-toggle-btn" type="button" style="margin-right: auto;">展開</button>
                <div>
                    <button id="nthu-helper-open-temp-list-btn" type="button" class="btn">開啟暫存課程清單</button>
                    <button id="nthu-helper-save-schedule-btn" type="button" class="btn">儲存課表至擴充功能</button>
                    <button id="nthu-helper-refresh-counts-btn" type="button" class="btn">更新即時人數</button>
                </div>
            </div>
            <div class="nthu-helper-content">
                <div class="filters">
                    <input type="text" id="nthu-helper-filter-courseNo" placeholder="篩選科目代碼...">
                    <input type="text" id="nthu-helper-filter-name" placeholder="篩選科目名稱...">
                    <input type="text" id="nthu-helper-filter-teacher" placeholder="篩選教師姓名...">
                    <div class="filter-options">
                      <label><input type="checkbox" id="nthu-helper-hide-clash"> 隱藏衝堂課程</label>
                      ${geClashCheckbox}
                      <label><input type="checkbox" id="nthu-helper-allow-xclass-clash"> 允許X-Class衝堂</label>
                    </div>
                      
                    
                </div>
                <div class="advanced-filters" style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
                    <div class="time-grid-container collapsed">
                        <div class="time-grid-header">
                            <h3>自訂時間篩選 <button id="nthu-helper-toggle-time-grid-btn" type="button" style="margin-bottom: 5px;">展開</button></h3>
                        </div>
                        <div class="strict-filter-container">
                              <label for="nthu-helper-strict-filter" class="switch-label">嚴格時間篩選</label>
                              <span class="info-icon">i
                                <span class="tooltip-text">關閉狀態時為模糊搜尋，例如當點擊 W2 時，所有課程中包含 W2 時間都會顯示。開啟後為嚴格篩選，即只有時間為 W2 的課程會顯示。</span>
                            </span>
                              <label class="switch">
                                  <input type="checkbox" id="nthu-helper-strict-filter">
                                  <span class="slider round"></span>
                              </label>
                        </div>
                        <div class="nthu-helper-time-grid">${this.createTimeGrid()}
                            <div class="time-grid-legend">
                                <span class="legend-color-box enrolled-slot-normal"></span> 已選課程
                                <span class="legend-color-box enrolled-slot-ge"></span> 已選通識
                            </div>
                        </div>
                    </div>
                    ${isGePage ? `
                    <div class="ge-category-filter-container">
                        <div class="ge-category-header">
                            <h3>通識類別篩選</h3>
                        </div>
                        <div class="ge-category-options">
                            <label><input type="checkbox" value="核心通識1"> 核心通識 1</label>
                            <label><input type="checkbox" value="核心通識2"> 核心通識 2</label>
                            <label><input type="checkbox" value="核心通識3"> 核心通識 3</label>
                            <label><input type="checkbox" value="核心通識4"> 核心通識 4</label>
                            <label><input type="checkbox" value="自然科學領域"> 自然科學領域</label>
                            <label><input type="checkbox" value="社會科學領域"> 社會科學領域</label>
                            <label><input type="checkbox" value="人文學領域"> 人文學領域</label>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        return container;
    },
    injectLiveCountColumn(table) {
        // 插入表頭
        const headerRow = table.querySelector('thead tr')
        if (headerRow) {
            const newHeaderCell = document.createElement('td');
            newHeaderCell.width = "8%";
            newHeaderCell.style = "text-decoration:none;  cursor: default;";
            newHeaderCell.innerHTML = '<div align="center" onmouseover="return overlib(\'此欄位查詢系統中的最新選課情況<br>This column queries the latest course selection status in the system<br>\',WIDTH,225,TEXTSIZE,2);" onmouseout="nd();">即時人數<br>（已選上 / 待亂數）<br>Live Count<br>(Enrolled / To be randomed)</div>';
            newHeaderCell.classList.add('live-count-header'); // 方便添加樣式
            // 插入在「大綱」欄位之前
            headerRow.insertBefore(newHeaderCell, headerRow.cells[headerRow.cells.length - 1]);
        }
        
        // 在每一行課程插入對應的儲存格
        const courseRows = table.querySelectorAll('tbody tr');
        courseRows.forEach(row => {
            if (row.cells.length > 1) { // 確保是課程行
                const courseIdCell = row.cells[1];
                if (courseIdCell) {
                    const courseId = courseIdCell.innerText.trim().replace(/\s+/g, '');
                    const newCell = row.insertCell(row.cells.length - 1); // 插入到倒數第二個位置
                    newCell.align = 'center';
                    newCell.innerHTML = `<div class="live-count-cell" id="count-${courseId}">---</div>`;
                }
            }
        });
    },

    // 建立 7x14 的時間選擇格子
    createTimeGrid() {
        let gridHTML = '<div class="time-header"><div></div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div></div>';
        const slots = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];
        slots.forEach(slot => {
            gridHTML += `<div class="time-row"><div class="time-label">${slot}</div>`;
            for (let day = 1; day <= 7; day++) {
                gridHTML += `<div class="time-slot" data-day="${day}" data-slot="${slot}"></div>`;
            }
            gridHTML += '</div>';
        });
        return gridHTML;
    },
    
    // 注入查詢按鈕到課程表格
    injectSearchButtons(table, courses) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            if (!courses[index]) return; // 如果該行沒有解析出課程資料，則跳過

            // 在科目名稱欄位新增按鈕
            const nameCell = row.cells[2];
            if (nameCell) {
                nameCell.style.position = 'relative';
                const searchBtn = this.createSearchButton(index);
                nameCell.appendChild(searchBtn);
            }
            
            // 在教師欄位新增按鈕
            const teacherCell = row.cells[6];
            if (teacherCell) {
                teacherCell.style.position = 'relative';
                const searchBtn = this.createSearchButton(index);
                teacherCell.appendChild(searchBtn);
            }
        });
    },

    createSaveScheduleButton() {
        const button = document.createElement('button');
        button.id = 'nthu-helper-save-schedule-btn';
        button.type = 'button';
        button.textContent = '儲存課表至擴充功能';
        button.className = 'btn'; // 借用頁面現有樣式
        return button;
    },
    
    // 建立單一查詢按鈕
    createSearchButton(index) {
        const button = document.createElement('button');
        button.className = 'nthu-helper-search-btn';
        button.type = 'button'; // 避免觸發 form submit
        button.innerHTML = '🔍';
        button.title = '查詢課程評價';
        button.dataset.index = index;
        return button;
    },
    
    // 顯示查詢選項菜單
    showSearchMenu(x, y, course) {
        const existingMenu = document.getElementById('nthu-helper-search-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'nthu-helper-search-menu';
        
        const teacherName = course.teacher.split('\n')[0];

        // 初始 HTML 結構
        menu.innerHTML = `
            <div class="menu-title">選擇查詢平台</div>
            <ul class="primary-menu">
                <li data-platform="dcard">Dcard</li>
                <li data-platform="nthumods">NTHU MODS</li>
                <li data-platform="opass">歐趴糖 (Opass)</li>
                <li data-platform="Google">Google</li>
            </ul>
            <ul class="secondary-menu" style="display: none;"></ul>
        `;
        
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        document.body.appendChild(menu);

        // ---【核心修改】使用單一事件監聽器處理所有點擊 ---
        menu.addEventListener('click', (event) => {
            const clickedLi = event.target.closest('li');
            if (!clickedLi) return;

            const platform = clickedLi.dataset.platform;
            const url = clickedLi.dataset.url;

            // --- 情況一：點擊了平台選項 (第一層) ---
            if (platform) {
                const primaryMenu = menu.querySelector('.primary-menu');
                const secondaryMenu = menu.querySelector('.secondary-menu');
                const menuTitle = menu.querySelector('.menu-title');
                
                let secondaryMenuHTML = `<li class="menu-back-btn">← 返回</li>`;

                switch(platform) {
                    case 'dcard':
                        menuTitle.textContent = 'Dcard 搜尋方式';
                        secondaryMenuHTML += `
                            <li data-url="https://www.dcard.tw/search?query=${encodeURIComponent(course.name)}&forum=nthu">查詢：課程名稱</li>
                            <li data-url="https://www.dcard.tw/search?query=${encodeURIComponent(teacherName)}&forum=nthu">查詢：教師名稱</li>
                            <li data-url="https://www.dcard.tw/search?query=${encodeURIComponent(course.name + ' ' + teacherName)}&forum=nthu">查詢：課名＋教師</li>
                        `;
                        break;
                    case 'opass':
                        menuTitle.textContent = '歐趴糖 搜尋方式';
                        function encodeFor1111OPT(payload) {
                            // 1) JSON -> URI 編碼
                            const uriEncoded = encodeURIComponent(JSON.stringify(payload));

                            // 2) URI 編碼字串 -> bytes，再做 base64
                            const bytes = new TextEncoder().encode(uriEncoded);
                            let binary = "";
                            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                            let b64 = btoa(binary);

                            // 3) 轉成 Base64-URL，並去掉 padding
                            return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
                        }
                        const createOpassUrl = (keyword) => {
                            // 建立符合網站 API 的物件
                            const searchParams = { "keyword": keyword, "college_id": 10935223, "type": 0, "order": "-modify_time" };
                            
                            
                            // 【關鍵修正】對整個 JSON 字串進行 URL 編碼
                            const encodedString = encodeFor1111OPT(searchParams);

                            return `https://www.1111opt.com.tw/search-result/${encodedString}`;
                        };
                        secondaryMenuHTML += `
                            <li data-url="${createOpassUrl(course.name)}">查詢：課程名稱</li>
                            <li data-url="${createOpassUrl(teacherName)}">查詢：教師名稱</li>
                            <li data-url="${createOpassUrl(course.name + ' ' + teacherName)}">查詢：課名＋教師</li>
                        `;
                        break;
                    case 'nthumods':
                        menuTitle.textContent = 'NTHU MODS 搜尋方式';
                        secondaryMenuHTML += `
                            <li data-url="https://nthumods.com/zh/courses?nthu_courses%5Bmenu%5D%5Bsemester%5D=&nthu_courses%5Bquery%5D=${encodeURIComponent(course.name)}">查詢：課程名稱</li>
                            <li data-url="https://nthumods.com/zh/courses?nthu_courses%5Bmenu%5D%5Bsemester%5D=&nthu_courses%5Bquery%5D=${encodeURIComponent(teacherName)}">查詢：教師名稱</li>
                            <li data-url="https://nthumods.com/zh/courses?nthu_courses%5Bmenu%5D%5Bsemester%5D=&nthu_courses%5Bquery%5D=${encodeURIComponent(course.id)}">查詢：科號</li>
                        `;
                        break;
                    case 'Google':
                        menuTitle.textContent = 'Google 搜尋方式';
                        secondaryMenuHTML += `
                            <li data-url="https://www.google.com/search?q=${encodeURIComponent(course.name + ' 清大')}">查詢：課程名稱</li>
                            <li data-url="https://www.google.com/search?q=${encodeURIComponent(teacherName + ' 清大')}">查詢：教師名</li>
                            <li data-url="https://www.google.com/search?q=${encodeURIComponent(course.name + ' ' + teacherName)}">查詢：課名＋教師</li>
                        `;
                        break;
                    default:
                        break;
                }
                
                primaryMenu.style.display = 'none';
                secondaryMenu.innerHTML = secondaryMenuHTML;
                secondaryMenu.style.display = 'block';
            }
            
            // --- 情況二：點擊了返回按鈕 ---
            else if (clickedLi.classList.contains('menu-back-btn')) {
                const primaryMenu = menu.querySelector('.primary-menu');
                const secondaryMenu = menu.querySelector('.secondary-menu');
                const menuTitle = menu.querySelector('.menu-title');

                secondaryMenu.style.display = 'none';
                primaryMenu.style.display = 'block';
                menuTitle.textContent = '選擇查詢平台';
            }

            // --- 情況三：點擊了最終的查詢連結 ---
            else if (url) {
                window.open(url, '_blank');
                menu.remove();
            }
        });

        // 點擊菜單外部即可關閉
        const closeMenu = (event) => {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    },

    // 建立回到最上方按鈕
    createBackToTopButton() {
        const button = document.createElement('button');
        button.id = 'nthu-helper-back-to-top';
        button.type = 'button';
        button.innerHTML = '↑';
        button.title = '回到最上方';
        return button;
    },

    // 更新時間格上的已選課程高亮
    updateTimeGridHighlights(enrolledCourses) {
        // 先清除所有舊的標記
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('enrolled-slot-normal', 'enrolled-slot-ge');
        });

        // 遍歷已選課程並標記
        enrolledCourses.forEach(course => {
            const isGeCourse = course.id.includes('GE') || course.isGe;
            course.time.forEach(timeSlot => {
                const slotElement = document.querySelector(`.time-slot[data-day="${timeSlot.day}"][data-slot="${timeSlot.slot}"]`);
                if (slotElement) {
                    slotElement.classList.add(isGeCourse ? 'enrolled-slot-ge' : 'enrolled-slot-normal');
                }
            });
        });
    },
    /**
     * 【新增】建立單一課程的「暫存」書籤按鈕
     * @param {number} index - 課程在 `courses` 陣列中的索引
     * @param {boolean} isSaved - 該課程是否已被儲存
     * @returns {HTMLLabelElement} - 完整的 <label> 元素
     */
    createBookmarkButton(index, isSaved) {
        const uniqueId = `nthu-helper-bookmark-${index}`;
        const label = document.createElement('label');
        label.className = 'bookmark';
        label.htmlFor = uniqueId;
        label.dataset.index = index;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = uniqueId;
        input.checked = isSaved;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '15');
        svg.setAttribute('viewBox', '0 0 50 70');
        svg.setAttribute('fill', 'none');
        svg.classList.add('svgIcon');
        svg.innerHTML = `<path d="M46 62.0085L46 3.88139L3.99609 3.88139L3.99609 62.0085L24.5 45.5L46 62.0085Z" stroke="black" stroke-width="7"></path>`;

        label.appendChild(input);
        label.appendChild(svg);
        return label;
    },

    /**
     * 【新增】在所有課程行注入「暫存」書籤按鈕
     * @param {HTMLTableElement} table - 課程表格
     * @param {Array<Object>} savedCourses - 已儲存的課程陣列
     */
    injectBookmarkButtons(table, savedCourses) {
        const savedCourseIds = new Set(savedCourses.map(c => c.id));
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach((row, index) => {
            const courseIdCell = row.cells[1];
            if (!courseIdCell) return;
            const courseId = courseIdCell.innerText.trim();

            if (row.cells.length > 1 && (row.querySelector('input[type="button"]') || row.querySelector('input[type="text"]'))) {
                const firstCell = row.cells[0];
                firstCell.style.position = 'relative'; // 為了定位
                
                const isSaved = savedCourseIds.has(courseId);
                const bookmarkBtn = this.createBookmarkButton(index, isSaved);
                
                firstCell.appendChild(bookmarkBtn);
            }
        });
    },

    /**
     * 【新增】建立浮動的「查看暫存清單」按鈕
     * @returns {HTMLButtonElement} - 浮動按鈕元素
     */
    createSavedListButton() {
        const button = document.createElement('button');
        button.id = 'nthu-helper-saved-list-btn';
        button.type = 'button';
        button.title = '查看暫存清單';
        button.innerHTML = `
            <div class="spinner-wrapper"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="saved-icon">
                <path d="M17.5 2.5H6.5C5.39543 2.5 4.5 3.39543 4.5 4.5V21.5L12 16.5L19.5 21.5V4.5C19.5 3.39543 18.6046 2.5 17.5 2.5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="count-badge">0</span>
        `;
        return button;
    },
    /**
     * 【新增】讓下拉式選單具有搜尋功能
     * @param {HTMLSelectElement} selectElement - 目標 select 元素
     */
    makeSelectSearchable(selectElement) {
        if (!selectElement || selectElement.dataset.enhanced === "true") return;
        
        selectElement.dataset.enhanced = "true";
        selectElement.style.display = 'none';

        // ... (中間建立 DOM 結構的程式碼保持不變: wrapper, trigger, dropdown, searchInput, optionsList) ...
        const wrapper = document.createElement('div');
        wrapper.className = 'nthu-helper-custom-select-wrapper';
        
        const trigger = document.createElement('div');
        trigger.className = 'nthu-helper-select-trigger';
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        trigger.textContent = selectedOption ? selectedOption.text : '請選擇...';

        const dropdown = document.createElement('div');
        dropdown.className = 'nthu-helper-select-dropdown';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'nthu-helper-select-search-input';
        searchInput.placeholder = '輸入關鍵字搜尋...';

        const optionsList = document.createElement('div');
        optionsList.className = 'nthu-helper-select-options';

        // 3. 填充選項
        const generateOptions = (filterText = '') => {
            optionsList.innerHTML = '';
            let hasMatch = false; // 用於判斷是否有內容

            Array.from(selectElement.options).forEach((opt, index) => {
                const text = opt.text;
                const value = opt.value;
                
                if (filterText && !text.toLowerCase().includes(filterText.toLowerCase()) && !value.toLowerCase().includes(filterText.toLowerCase())) {
                    return;
                }

                const optionDiv = document.createElement('div');
                optionDiv.className = 'nthu-helper-custom-option';
                optionDiv.textContent = text;
                optionDiv.dataset.value = value;
                optionDiv.dataset.index = index;

                // 標示目前選中的項目 (selected 是指資料庫已選的值)
                if (index === selectElement.selectedIndex) {
                    optionDiv.classList.add('selected');
                }

                // 【新增】如果是搜尋結果的第一項，預設給它 focused (方便直接按 Enter)
                if (!hasMatch) {
                    optionDiv.classList.add('focused');
                }
                hasMatch = true;

                optionDiv.addEventListener('click', () => {
                    selectElement.selectedIndex = index;
                    const event = new Event('change', { bubbles: true });
                    selectElement.dispatchEvent(event);
                    trigger.textContent = text;
                    dropdown.classList.remove('show');
                });

                optionsList.appendChild(optionDiv);
            });

            if (optionsList.children.length === 0) {
                const noMatch = document.createElement('div');
                noMatch.className = 'nthu-helper-no-match';
                noMatch.textContent = '無符合項目';
                optionsList.appendChild(noMatch);
            }
        };

        generateOptions();

        // 4. 事件綁定

        // ... (trigger 的 click 事件保持不變) ...
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.nthu-helper-select-dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
            
            if (dropdown.classList.contains('show')) {
                searchInput.value = '';
                generateOptions(''); 
                setTimeout(() => searchInput.focus(), 50);
                
                // 捲動到 selected 項目
                const selectedEl = optionsList.querySelector('.selected');
                if (selectedEl) {
                    // 同步更新 focused 到 selected 項目上
                    optionsList.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
                    selectedEl.classList.add('focused');
                    optionsList.scrollTop = selectedEl.offsetTop - optionsList.offsetTop;
                }
            }
        });

        // 搜尋輸入事件 (保持不變)
        searchInput.addEventListener('input', (e) => {
            generateOptions(e.target.value.trim());
        });

        // 【新增】鍵盤導航事件 (綁定在 input 上，因為焦點在那裡)
        searchInput.addEventListener('keydown', (e) => {
            const visibleOptions = Array.from(optionsList.querySelectorAll('.nthu-helper-custom-option'));
            if (visibleOptions.length === 0) return;

            // 找到目前 focused 的索引
            let focusedIndex = visibleOptions.findIndex(opt => opt.classList.contains('focused'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                // 往下移動，若到底則停在最後 (或是循環回到 0 也可以，這裡選停住)
                const nextIndex = focusedIndex < visibleOptions.length - 1 ? focusedIndex + 1 : visibleOptions.length - 1; // 停在最後
                // const nextIndex = (focusedIndex + 1) % visibleOptions.length; // 循環
                updateFocus(visibleOptions, nextIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                // 往上移動
                const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : 0;
                updateFocus(visibleOptions, prevIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex !== -1) {
                    visibleOptions[focusedIndex].click(); // 模擬點擊
                    searchInput.blur();
                }
            }
        });

        // 【輔助函式】更新 Focus 狀態與捲動
        function updateFocus(options, index) {
            options.forEach(opt => opt.classList.remove('focused'));
            if (index >= 0 && index < options.length) {
                const target = options[index];
                target.classList.add('focused');
                
                // 自動捲動邏輯
                const containerTop = optionsList.scrollTop;
                const containerBottom = containerTop + optionsList.clientHeight;
                const elemTop = target.offsetTop;
                const elemBottom = elemTop + target.offsetHeight;

                if (elemTop < containerTop) {
                    optionsList.scrollTop = elemTop;
                } else if (elemBottom > containerBottom) {
                    optionsList.scrollTop = elemBottom - optionsList.clientHeight;
                }
            }
        }

        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        dropdown.appendChild(searchInput);
        dropdown.appendChild(optionsList);
        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);

        if (selectElement.parentNode) {
            selectElement.parentNode.insertBefore(wrapper, selectElement);
        }
    },
};