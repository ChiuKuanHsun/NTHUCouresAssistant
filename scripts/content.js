// scripts/content.js
// 這是擴充功能的進入點 (Entry Point)

function applyFramesetRatio(ratio) {
    // 確保我們在最外層的 frameset 頁面
    const frameset = document.querySelector('frameset');
    if (frameset) {
        frameset.rows = `${ratio},*`;
    }
}

// 【新增】監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateFramesetRatio") {
        applyFramesetRatio(request.ratio);
        sendResponse({ status: "success" }); // 回覆 popup，表示已處理
    }
    return true; // 保持 message channel 開啟以異步回覆
});

// 頁面載入後執行的主函式
function main() {
    if (window.location.href.includes('JH713003.php')) {
        chrome.storage.sync.get(['framesetRatio'], (result) => {
            if (result.framesetRatio) {
                applyFramesetRatio(result.framesetRatio);
            }
        });
    }
    // 檢查這是否是「加選」的那個表格
    const deptSelect = document.querySelector('select[name="new_dept"]');
    if (!deptSelect) {
        return;
    }
    const courseTable = document.getElementById('T1');
    if (!courseTable) {
        return;
    }
    
    

    // 1. 注入 UI 介面
    const selectedDept = deptSelect.value;
    const isGePage = selectedDept.includes('GE');
    const filterUI = NthuCourseHelperUI.createFilterUI(isGePage);
    courseTable.parentNode.insertBefore(filterUI, courseTable);
    
    NthuCourseHelperUI.injectLiveCountColumn(courseTable);

    // 2. 解析可加選課程
    const courses = NthuCourseParser.parseCourseTable(courseTable);
    NthuCourseHelperUI.injectSearchButtons(courseTable, courses);

    // 3. 注入回到最上方按鈕
    const backToTopButton = NthuCourseHelperUI.createBackToTopButton();
    document.body.appendChild(backToTopButton);

    // 4. 設定事件監聽器
    setupEventListeners(courses, courseTable, backToTopButton);

    
    const form = document.querySelector('form[name="form1"]');
    if (!form) return;
    const mainFrame = window.parent.frames['mainFrame'];
    const saveButton = NthuCourseHelperUI.createSaveScheduleButton();
    form.insertBefore(saveButton, form.firstChild); // 將按鈕加到頁面最上方

    // 為儲存按鈕特別綁定事件
    saveButton.addEventListener('click', () => {
        const enrolledCourses = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
        chrome.storage.sync.set({ 'savedSchedule': enrolledCourses }, () => {
            alert('課表已成功儲存！');
            saveButton.textContent = '課表已儲存';
            saveButton.disabled = true;
        });
    });
    
    
}

// 設定所有事件監聽
function setupEventListeners(courses, table, backToTopButton) {
    const nameFilter = document.getElementById('nthu-helper-filter-name');
    const teacherFilter = document.getElementById('nthu-helper-filter-teacher');
    const timeGrid = document.querySelector('.nthu-helper-time-grid');
    const hideClashCheckbox = document.getElementById('nthu-helper-hide-clash');
    const toggleBtn = document.getElementById('nthu-helper-toggle-btn');
    const container = document.querySelector('.nthu-helper-container');
    const timeGridContainer = document.querySelector('.time-grid-container');
    const timeGridToggleBtn = document.getElementById('nthu-helper-toggle-time-grid-btn');
    const allowGeClashCheckbox = document.getElementById('nthu-helper-allow-ge-clash');
    const strictFilterCheckbox = document.getElementById('nthu-helper-strict-filter');
    const allowXClassClashCheckbox = document.getElementById('nthu-helper-allow-xclass-clash');
    const refreshBtn = document.getElementById('nthu-helper-refresh-counts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.textContent = '更新中...';
            refreshBtn.disabled = true;

            // 顯示所有課程的 loading spinner
            document.querySelectorAll('.live-count-cell').forEach(cell => {
                cell.innerHTML = `<div class="spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>`;
            });

            // 取得目前頁面的系所代碼
            const deptSelect = document.querySelector('select[name="new_dept"]');
            const departmentId = deptSelect.value.trim();

            const countsMap = await NthuCourseParser.fetchAndParseCounts(departmentId);

            // 更新頁面上的數字
            countsMap.forEach((data, courseId) => {
                const cell = document.getElementById(`count-${courseId}`);
                if (cell) {
                    cell.innerHTML = `${data.enrolled} / ${data.waiting}`;
                }
            });

            // 將沒有抓到資料的欄位恢復預設
            document.querySelectorAll('.live-count-cell').forEach(cell => {
                if (cell.innerHTML.includes('spinner')) {
                    cell.innerHTML = 'N/A';
                }
            });

            refreshBtn.textContent = '更新即時人數';
            refreshBtn.disabled = false;
        });
    }
    // 統一的篩選觸發函數
    const runFilter = () => {
        const mainFrame = window.parent.frames['mainFrame'];
        let enrolledSchedule = [];
        if (mainFrame && mainFrame.document) {
            enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
        } else {
            console.error("找不到 mainFrame，無法讀取已選課程進行衝堂判斷。");
        }
        NthuCourseFilter.filterAll(table, courses, enrolledSchedule);
    };

    // --- 主要篩選器的事件 --- 
    toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        container.classList.toggle('collapsed');
        toggleBtn.textContent = container.classList.contains('collapsed') ? '展開' : '收合';
    });
    nameFilter.addEventListener('input', runFilter);
    teacherFilter.addEventListener('input', runFilter);
    hideClashCheckbox.addEventListener('change', runFilter);
    if (allowGeClashCheckbox) {
        allowGeClashCheckbox.addEventListener('change', runFilter);
    }
    if (allowXClassClashCheckbox) {
        allowXClassClashCheckbox.addEventListener('change', runFilter);
    }
    if (strictFilterCheckbox) {
        strictFilterCheckbox.addEventListener('change', runFilter);
    }
    // --- 時間篩選器的事件 ---
    if (timeGridToggleBtn && timeGridContainer) {
        timeGridToggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const isCollapsed = timeGridContainer.classList.toggle('collapsed');
            timeGridToggleBtn.textContent = isCollapsed ? '展開' : '收合';

            if (!isCollapsed) {
                const mainFrame = window.parent.frames['mainFrame'];
                if (mainFrame && mainFrame.document) {
                    const enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
                    NthuCourseHelperUI.updateTimeGridHighlights(enrolledSchedule);
                }
            }
        });
    }
    timeGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('time-slot')) {
            event.target.classList.toggle('selected');
            runFilter();
        }
    });

    // --- 課程列表的事件 ---
    table.addEventListener('click', (event) => {
        const target = event.target.closest('.nthu-helper-search-btn');
        if (!target) return;

        const courseIndex = parseInt(target.dataset.index, 10);
        const course = courses[courseIndex];
        
        if(course) {
            NthuCourseHelperUI.showSearchMenu(event.clientX, event.clientY, course);
        }
    });

    // --- 回到最上方按鈕的事件 ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 執行主函式
main();