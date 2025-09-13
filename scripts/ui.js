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

        container.innerHTML = `
            <div class="nthu-helper-header">
                <h2>NTHU COURSE ASSISTANT</h2>
                <button id="nthu-helper-toggle-btn" type="button" style="margin-right: auto;">展開</button>
                <div>
                    <button id="nthu-helper-save-schedule-btn" type="button" class="btn">儲存課表至擴充功能</button>
                    <button id="nthu-helper-refresh-counts-btn" type="button" class="btn">更新即時人數</button>
                </div>
            </div>
            <div class="nthu-helper-content">
                <div class="filters">
                    <input type="text" id="nthu-helper-filter-name" placeholder="篩選課程名稱...">
                    <input type="text" id="nthu-helper-filter-teacher" placeholder="篩選教師姓名...">
                    <div class="filter-options">
                      <label><input type="checkbox" id="nthu-helper-hide-clash"> 隱藏衝堂課程</label>
                      ${geClashCheckbox}
                      <label><input type="checkbox" id="nthu-helper-allow-xclass-clash"> 允許X-Class衝堂</label>
                    </div>
                      
                    
                </div>
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
            newHeaderCell.innerHTML = '<div align="center" onmouseover="return overlib(\'此欄位查詢系統中的最新選課情況<br>This column queries the latest course selection status in the system<br>\',WIDTH,225,TEXTSIZE,2);" onmouseout="nd();">即時人數<br>（已選上/待亂數）<br>Live Count<br>(Enrolled/Wait for random)</div>';
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
                        secondaryMenuHTML += `
                            <li data-url="https://www.opass.app/search?q=${encodeURIComponent(course.name)}">查詢：課程名稱</li>
                            <li data-url="https://www.opass.app/search?q=${encodeURIComponent(teacherName)}">查詢：教師名稱</li>
                            <li data-url="https://www.opass.app/search?q=${encodeURIComponent(course.name + ' ' + teacherName)}">查詢：課名＋教師</li>
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
};